export default class SetAudio {
    constructor(audioSrc, volume = 0.05, delay = 8000) {
        this.audio = new Audio(audioSrc)
        this.audio.volume = volume
        this.initialVolume = volume  // Store initial volume for future reference
        this.audio.preload = 'auto'
        this.delay = delay
        this.isPlaying = false
        this.fadeDuration = 1000
        this.fadeInterval = null  // Add this to track our fade interval
        this._setupListeners()
    }

    _setupListeners() {
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false
            setTimeout(() => {
                this.audio.currentTime = 0
                this.play()
            }, this.delay)
        })
    }

    play() {
        if (!this.isPlaying) {
            // Reset volume to initial value when playing
            this.audio.volume = this.initialVolume
            this.audio.play().catch((error) => {
                console.error("Audio playback failed", error)
            })
            this.isPlaying = true
        }
    }

    stop() {
        if (this.isPlaying) {
            // Clear any existing fade interval
            if (this.fadeInterval) {
                clearInterval(this.fadeInterval)
            }

            const fadeSteps = 50 // Number of steps in the fade
            const timeStep = this.fadeDuration / fadeSteps
            const volumeStep = this.audio.volume / fadeSteps

            this.fadeInterval = setInterval(() => {
                if (this.audio.volume > volumeStep) {
                    this.audio.volume -= volumeStep
                } else {
                    // Clear the interval and fully stop the audio
                    clearInterval(this.fadeInterval)
                    this.fadeInterval = null
                    this.audio.pause()
                    this.audio.currentTime = 0
                    this.audio.volume = this.initialVolume // Reset volume for next play
                    this.isPlaying = false
                }
            }, timeStep)
        }
    }
}