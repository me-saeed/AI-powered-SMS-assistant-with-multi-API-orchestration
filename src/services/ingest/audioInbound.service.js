const openaiService = require("../ai/openai.service");
const logger = require("../../utils/logger");
const { BadRequestError } = require("../../utils/httpError");

class AudioInboundService {
  constructor() {
    this.maxAudioSize = 25 * 1024 * 1024; // 25MB
  }

  /**
   * Handle incoming audio and transcribe it
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} - Object with transcript and usedAudio flag
   */
  async handleAudioInbound(req) {
    try {
      const { transcript, usedAudio } = await this.processInboundAudio(req);

      logger.info("Audio inbound processing completed", {
        usedAudio,
        transcriptLength: transcript ? transcript.length : 0,
      });

      return { transcript, usedAudio };
    } catch (error) {
      logger.error("Audio inbound processing failed", {
        error: error.message,
        requestId: req.id || "unknown",
      });
      throw error;
    }
  }

  /**
   * Process incoming audio from request
   * @param {Object} req - Express request object
   * @returns {Promise<Object>} - Processing result
   */
  async processInboundAudio(req) {
    // Check if request has audio content
    if (!req.body || !req.body.MediaUrl0) {
      return { transcript: null, usedAudio: false };
    }

    const audioUrl = req.body.MediaUrl0;
    const mediaContentType = req.body.MediaContentType0;

    logger.info("Processing audio inbound", {
      audioUrl,
      mediaContentType,
      requestId: req.id || "unknown",
    });

    try {
      // Download and process audio
      const audioBuffer = await this.downloadAudio(audioUrl);

      if (audioBuffer.length > this.maxAudioSize) {
        logger.warn("Audio file too large", {
          size: audioBuffer.length,
          maxSize: this.maxAudioSize,
        });
        return { transcript: "audio too large", usedAudio: true };
      }

      // Transcribe audio
      const transcript = await openaiService.transcribeAudioBuffer(
        audioBuffer,
        "audio.wav",
        mediaContentType || "audio/wav"
      );

      return { transcript, usedAudio: true };
    } catch (error) {
      logger.error("Audio processing failed", {
        error: error.message,
        audioUrl,
        requestId: req.id || "unknown",
      });

      if (error.message.includes("too large")) {
        return { transcript: "audio too large", usedAudio: true };
      }

      throw new BadRequestError("Failed to process audio: " + error.message);
    }
  }

  /**
   * Download audio from URL
   * @param {string} audioUrl - URL of the audio file
   * @returns {Promise<Buffer>} - Audio buffer
   */
  async downloadAudio(audioUrl) {
    try {
      const axios = require("axios");

      logger.info("Downloading audio file", { audioUrl });

      const response = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
        maxContentLength: this.maxAudioSize,
      });

      const buffer = Buffer.from(response.data);

      logger.info("Audio download completed", {
        size: buffer.length,
        contentType: response.headers["content-type"],
      });

      return buffer;
    } catch (error) {
      logger.error("Audio download failed", {
        error: error.message,
        audioUrl,
      });
      throw new Error("Failed to download audio file");
    }
  }

  /**
   * Validate audio file
   * @param {Buffer} audioBuffer - Audio buffer to validate
   * @param {string} contentType - MIME type
   * @returns {boolean} - True if valid
   */
  validateAudio(audioBuffer, contentType) {
    if (!audioBuffer || audioBuffer.length === 0) {
      return false;
    }

    if (audioBuffer.length > this.maxAudioSize) {
      return false;
    }

    const supportedTypes = openaiService.getSupportedFormats();
    return supportedTypes.includes(contentType);
  }
}

module.exports = new AudioInboundService();
