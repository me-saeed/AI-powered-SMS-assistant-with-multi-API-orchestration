const axios = require("axios");
const FormData = require("form-data");
const config = require("../../config");
const logger = require("../../utils/logger");
const {
  ServiceUnavailableError,
  BadRequestError,
} = require("../../utils/httpError");

class OpenAIService {
  constructor() {
    this.apiKey = config.ai.openai.apiKey;
    this.baseURL = config.ai.openai.baseURL;
    this.model = config.ai.openai.model;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 60000, // 60 seconds for audio processing
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  /**
   * Transcribe audio buffer using OpenAI Whisper API
   * @param {Buffer} buffer - Audio buffer to transcribe
   * @param {string} filename - Filename for the audio
   * @param {string} mime - MIME type of the audio
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeAudioBuffer(
    buffer,
    filename = "audio.wav",
    mime = "audio/wav"
  ) {
    try {
      if (!buffer || buffer.length === 0) {
        throw new BadRequestError("Audio buffer is empty or invalid");
      }

      logger.info("Starting audio transcription", {
        filename,
        mimeType: mime,
        bufferSize: buffer.length,
      });

      const form = new FormData();
      form.append("file", buffer, {
        filename,
        contentType: mime,
      });
      form.append("model", this.model);

      const response = await this.client.post("", form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (response.data && response.data.text) {
        const transcribedText = response.data.text.trim();

        logger.info("Audio transcription successful", {
          filename,
          originalLength: buffer.length,
          transcribedLength: transcribedText.length,
        });

        return transcribedText;
      } else {
        logger.error("Unexpected response structure from OpenAI Whisper", {
          responseData: response.data,
        });
        throw new BadRequestError(
          "Invalid response structure from OpenAI Whisper"
        );
      }
    } catch (error) {
      if (error.response) {
        // API responded with error status
        logger.error("OpenAI Whisper API error response", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
        });

        switch (error.response.status) {
          case 400:
            throw new BadRequestError(
              "Invalid audio format or request to OpenAI Whisper"
            );
          case 401:
            throw new BadRequestError("Invalid OpenAI API key");
          case 413:
            throw new BadRequestError(
              "Audio file too large for OpenAI Whisper"
            );
          case 429:
            throw new BadRequestError(
              "Rate limit exceeded for OpenAI Whisper API"
            );
          case 500:
            throw new ServiceUnavailableError(
              "OpenAI Whisper service temporarily unavailable"
            );
          default:
            throw new ServiceUnavailableError(
              `OpenAI Whisper API error: ${error.response.status}`
            );
        }
      } else if (error.request) {
        // Request was made but no response received
        logger.error("No response received from OpenAI Whisper API", {
          error: error.message,
        });
        throw new ServiceUnavailableError(
          "No response from OpenAI Whisper API"
        );
      } else {
        // Something else happened
        logger.error("Error setting up OpenAI Whisper API request", {
          error: error.message,
        });
        throw new ServiceUnavailableError(
          "Failed to communicate with OpenAI Whisper API"
        );
      }
    }
  }

  /**
   * Transcribe audio from various sources
   * @param {Buffer|string} audioSource - Audio buffer or file path
   * @param {Object} options - Transcription options
   * @returns {Promise<string>} - Transcribed text
   */
  async transcribeAudio(audioSource, options = {}) {
    const {
      filename = "audio.wav",
      mime = "audio/wav",
      language = null,
      prompt = null,
    } = options;

    try {
      let buffer;

      if (Buffer.isBuffer(audioSource)) {
        buffer = audioSource;
      } else if (typeof audioSource === "string") {
        // Handle file path if needed
        throw new BadRequestError(
          "File path transcription not implemented yet"
        );
      } else {
        throw new BadRequestError("Invalid audio source type");
      }

      // Validate file size (OpenAI has limits)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (buffer.length > maxSize) {
        throw new BadRequestError(
          "Audio file too large. Maximum size is 25MB."
        );
      }

      return await this.transcribeAudioBuffer(buffer, filename, mime);
    } catch (error) {
      logger.error("Audio transcription failed", {
        error: error.message,
        filename,
        mimeType: mime,
      });
      throw error;
    }
  }

  /**
   * Test the OpenAI Whisper API connection
   * @returns {Promise<boolean>} - True if connection is successful
   */
  async testConnection() {
    try {
      // Create a minimal test audio buffer (silence)
      const testBuffer = Buffer.alloc(1024);

      // This will likely fail due to invalid audio, but we can check the API key
      await this.transcribeAudioBuffer(testBuffer, "test.wav", "audio/wav");
      return true;
    } catch (error) {
      // If it's a 400 error, the API key is working but audio is invalid
      if (error.statusCode === 400 && error.message.includes("Invalid audio")) {
        logger.info(
          "OpenAI Whisper API connection test successful (API key valid)"
        );
        return true;
      }

      logger.error("OpenAI Whisper API connection test failed", {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get supported audio formats
   * @returns {Array} - Array of supported MIME types
   */
  getSupportedFormats() {
    return [
      "audio/wav",
      "audio/mp3",
      "audio/mp4",
      "audio/mpeg",
      "audio/mpga",
      "audio/webm",
      "audio/ogg",
    ];
  }

  /**
   * Get API usage statistics (if available)
   * @returns {Promise<Object>} - Usage statistics
   */
  async getUsageStats() {
    try {
      return {
        model: this.model,
        baseURL: this.baseURL,
        status: "operational",
        supportedFormats: this.getSupportedFormats(),
      };
    } catch (error) {
      logger.error("Failed to get OpenAI Whisper usage stats", {
        error: error.message,
      });
      return { status: "unknown" };
    }
  }
}

module.exports = new OpenAIService();
