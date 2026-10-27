import { config } from '../config'

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private stream: MediaStream | null = null

  async start(): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser.')
    }

    this.audioChunks = []
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    // Determine the supported mimeType for cross-browser / iPhone compatibility
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
    ]

    let selectedMimeType = ''
    if (typeof MediaRecorder !== 'undefined') {
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType
          break
        }
      }
    }

    const options: MediaRecorderOptions = selectedMimeType ? { mimeType: selectedMimeType } : {}
    this.mediaRecorder = new MediaRecorder(this.stream, options)

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.start(150)
  }

  async stop(): Promise<{ blob: Blob; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Recorder was not started.'))
        return
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm'
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })

        // Stop all audio tracks to release microphone
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop())
          this.stream = null
        }

        this.mediaRecorder = null
        resolve({ blob: audioBlob, mimeType })
      }

      this.mediaRecorder.stop()
    })
  }

  cancel(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    this.mediaRecorder = null
    this.audioChunks = []
  }
}

/**
 * Transcribe Egyptian Arabic & English code-switching audio using Groq Whisper Large v3
 */
export async function transcribeAudioWithGroq(audioBlob: Blob, mimeType: string): Promise<string> {
  const apiKey = config.transcription.apiKey
  if (!apiKey) {
    throw new Error('Groq API Key is missing. Please set GROQ_API_KEY in your .env file.')
  }

  const formData = new FormData()
  // Determine file extension
  let filename = 'recording.webm'
  if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
    filename = 'recording.mp4'
  } else if (mimeType.includes('aac')) {
    filename = 'recording.aac'
  } else if (mimeType.includes('ogg')) {
    filename = 'recording.ogg'
  }

  formData.append('file', audioBlob, filename)
  formData.append('model', config.transcription.model || 'whisper-large-v3')

  // Context prompt biases Whisper towards Egyptian Arabic code-switching and programming terms
  formData.append(
    'prompt',
    'Egyptian Arabic and English technical code-switching. Software engineering terms: React, Next.js, Supabase, TypeScript, API, Docker, Tailwind CSS, SQL, frontend, backend, dashboard, authentication.'
  )
  formData.append('response_format', 'json')

  const baseUrl = config.transcription.baseUrl.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMsg = `Transcription failed (${response.status})`
    try {
      const errJson = JSON.parse(errorText)
      if (errJson?.error?.message) {
        errorMsg = errJson.error.message
      }
    } catch {
      // Use raw text if not json
    }
    throw new Error(errorMsg)
  }

  const data = await response.json()
  return data.text ? data.text.trim() : ''
}
