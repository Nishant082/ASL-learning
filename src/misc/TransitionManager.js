import SetAudio from '../misc/audioManager'

export default class TransitionManager {
    constructor(document, window, interactInstance) {
        this.domElement = document
        this.window = window
        this.interactInstance = interactInstance
        this.npcScreenAudio = new SetAudio("./music/cort_salsaclasica_dm.mp3")
        this._Initialize()
    }

    _Initialize() {
        this.transitionOverlay = this.domElement.getElementById('transition-overlay')
        this.canvas = this.domElement.querySelector('.webgl')
        this.questUI = this.domElement.getElementById('questUI')
    }

    _TriggerTransition(answer) {
        return new Promise((resolve) => {
            this.transitionOverlay.classList.add('expand')

            setTimeout(() => {

            }, 0)

            setTimeout(() => {
                this.npcScreenAudio.play()
                this.canvas.style.display = 'none'
                this.transitionOverlay.classList.remove('expand')
                this.interactInstance._HandleQuest(answer)
                this.transitionOverlay.classList.add('shrink')
            }, 1500)

            setTimeout(() => {
                this.transitionOverlay.classList.remove("shrink")
                resolve()
            }, 3000)
        })
    }

    _TriggerGoBack(audio) {
        return new Promise((resolve) => {
            this.transitionOverlay.classList.add('expand')

            setTimeout(() => {
                this.npcScreenAudio.stop()
            }, 0)

            setTimeout(() => {
                audio.play()
                this.questUI.style.display = 'none'
                this.transitionOverlay.classList.remove('expand')
                this.interactInstance._CloseQuest()
                this.canvas.style.display = 'block'
                this.transitionOverlay.classList.add('shrink')
            }, 1500)

            setTimeout(() => {
                this.transitionOverlay.classList.remove('shrink')
                resolve()
            }, 3000)
        })
    }

    _TriggerLoad() {
        return new Promise((resolve) => {
            this.transitionOverlay.classList.add('expand')
            resolve()
        })
    }

    _TriggerLoadTransition() {
        return new Promise((resolve) => {
            setTimeout(() => {

            }, 0)

            setTimeout(() => {
                this.transitionOverlay.classList.remove('expand')
                this.transitionOverlay.classList.add('shrink')
            }, 800)

            setTimeout(() => {
                this.transitionOverlay.classList.remove('shrink')
                resolve()
            }, 1600)
        })
    }
}