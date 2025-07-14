import { Vector3 } from "three";

export default class ThirdPersonCamera {
    constructor(params) {
        this._params = params;
        this._camera = params.camera;
        this._currentPosition = new Vector3();
        this._currentLookat = new Vector3();
        this._idealOffset = new Vector3(0, 0.7, -0.5);
        this._idealLookat = new Vector3(0, 0.8, 1.5);
    }

    _CalculateIdealOffset() {
        const idealOffset = this._idealOffset.clone();
        const targetRotation = this._params.target.Rotation;
        
        // Ensure rotation is valid before applying
        if (targetRotation && !isNaN(targetRotation.x) && !isNaN(targetRotation.y) && 
            !isNaN(targetRotation.z) && !isNaN(targetRotation.w)) {
            idealOffset.applyQuaternion(targetRotation);
            idealOffset.add(this._params.target.Position);
        }
        return idealOffset;
    }

    _CalculateIdealLookat() {
        const idealLookat = this._idealLookat.clone();
        const targetRotation = this._params.target.Rotation;
        
        // Ensure rotation is valid before applying
        if (targetRotation && !isNaN(targetRotation.x) && !isNaN(targetRotation.y) && 
            !isNaN(targetRotation.z) && !isNaN(targetRotation.w)) {
            idealLookat.applyQuaternion(targetRotation);
            idealLookat.add(this._params.target.Position);
        }
        return idealLookat;
    }

    Update(timeElapsed) {
        if (!this._params.target) return;

        const idealOffset = this._CalculateIdealOffset();
        const idealLookat = this._CalculateIdealLookat();

        // Smooth interpolation factor
        const t = 1.0 - Math.pow(0.001, timeElapsed);

        // Ensure positions are valid before interpolating
        if (this._currentPosition.lengthSq() === 0) {
            this._currentPosition.copy(idealOffset);
        }
        if (this._currentLookat.lengthSq() === 0) {
            this._currentLookat.copy(idealLookat);
        }

        // Interpolate positions
        this._currentPosition.lerp(idealOffset, t);
        this._currentLookat.lerp(idealLookat, t);

        // Update camera only if positions are valid
        if (this._currentPosition.lengthSq() > 0 && this._currentLookat.lengthSq() > 0) {
            this._camera.position.copy(this._currentPosition);
            this._camera.lookAt(this._currentLookat);
        }
    }
}