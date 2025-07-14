import State from "./State"

export default class StrafeLeftRunState extends State {
    constructor(parent) {
        super(parent)
    }

    get Name() {
        return 'strafeLeftRun'
    }

    Enter(prevState) {
        const curAction = this._parent._proxy._animations['strafeLeftRun'].action
        if (prevState) {
            const prevAction = this._parent._proxy._animations[prevState.Name].action

            curAction.enabled = true

            if (prevState.Name == 'strafeLeftWalk') {
                const ratio = curAction.getClip().duration / prevAction.getClip().duration
                curAction.time = prevAction.time * ratio
            } else {
                curAction.time = 0.0
                curAction.setEffectiveTimeScale(1.0)
                curAction.setEffectiveWeight(1.0)
            }
            
            curAction.crossFadeFrom(prevAction, 0.5, true)
            curAction.play()
        } else {
            curAction.play()
        }
    }

    Exit() {
        // Handle exit logic if needed
    }

    Update(timeElapsed, input) {
        if (!input._keys.shift) {
            // If the player stops holding shift, switch back to walking while strafing
            this._parent.SetState('strafeLeftWalk')
            return
        }
        if (input._keys.left) {
            // Continue running while strafing
            return
        }
        this._parent.SetState('idle') // No movement, go back to idle
    }
}
