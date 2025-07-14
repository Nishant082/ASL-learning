export default class BasicCharacterControllerProxy {
    constructor(animations) {
      this._animations = animations
    }
  
    get animations() {
      return this._animations
    }
}