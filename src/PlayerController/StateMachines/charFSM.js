import FiniteStateMachine from "./FSM"
import IdleState from "./States/idleState"
import WalkState from "./States/walkState"
import RunState from "./States/runState"
import StrafeLeftWalkState from "./States/strafeLeftWalk"
import StrafeLeftRunState from "./States/strafeLeftRun"
import StrafeRightWalkState from "./States/strafeRightWalk"
import StrafeRightRunState from "./States/strafeRightRun"

export default class CharacterFSM extends FiniteStateMachine {
    constructor(proxy) {
        super()
        this._proxy = proxy
        this._Init()
    }

    _Init() {
        this._AddState('idle', IdleState)
        this._AddState('walk', WalkState)
        this._AddState('run', RunState)
        this._AddState('strafeLeftWalk', StrafeLeftWalkState)
        this._AddState('strafeLeftRun', StrafeLeftRunState)
        this._AddState('strafeRightWalk', StrafeRightWalkState)
        this._AddState('strafeRightRun', StrafeRightRunState)
    }
}