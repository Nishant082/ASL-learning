import State from "./State"

export default class StrafeRightWalkState extends State {
    constructor(parent) {
        super(parent)
    }

    get Name() {
        return 'strafeRightWalk'
    }

    Enter(prevState) {
        const curAction = this._parent._proxy._animations['strafeRightWalk'].action
        if (prevState) {
            const prevAction = this._parent._proxy._animations[prevState.Name].action

            curAction.enabled = true

            if (prevState.Name == 'strafeRightRun') {
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
        // This could be expanded to handle exit logic, if needed.
    }

    Update(timeElapsed, input) {
        if (input._keys.right) {
            if (input._keys.shift) {
                // Transition to 'strafeLeftRun' when 'shift' is held down (running while strafing)
                this._parent.SetState('strafeRightRun')
            }
            return
        }
        this._parent.SetState('idle')
    }
}
