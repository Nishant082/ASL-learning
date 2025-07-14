import * as RAPIER from '@dimforge/rapier3d-compat';   //calculating physics wallah
import * as THREE from 'three';                        //3d models 
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js'  //outline animation
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'     //graphic animations
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'   //graphic animations
import RapierDebugRenderer from './physicsEngine/debugRenderer'; // capsule vision :: dont crash wall
import BasicCharacterControllerProxy from './PlayerController/controllerProxy.js';  //character keybinding movements 
import building from "./physicsEngine/building.json"    //capsule physics       
import CharacterFSM from "./PlayerController/StateMachines/charFsm.js" //ATC ::left right slight alternation movements
import ThirdPersonCamera from "./PlayerController/thirdPersonCamera.js" //tpp
import NPCInteraction from './npcsData/interaction.js'  //keyboard interactions :: also uses DOM model for distance based calculations
import TransitionManager from './misc/TransitionManager.js'; //smoother transitions:: animations on loading
import SetAudio from './misc/audioManager.js'  //for all game audio

class PhysicsEngine {
    constructor(scene) {
        this._scene = scene
        this._world = null
        this._dynamicBodies = []
    }

     _CreatePhysicWorld() {
        const gravity = new RAPIER.Vector3(0.0, -30, 0.0); // up-down stairs logic
        this._world = new RAPIER.World(gravity); 
        this._dynamicBodies = []; 
    }

    init() {
        this._CreatePhysicWorld();  
        // this._debug = new RapierDebugRenderer(this._scene, this._world)
    }

    createCollisions() {
        this.createGround()  //environment of game
        this.createBuilding()
    }

    createGround() {
        const floorBody = this._world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0))
        const floorShape = RAPIER.ColliderDesc.cuboid(25, 0.025, 25)
        this._world.createCollider(floorShape, floorBody)
    }

    createPhysic(vec, pos, rot) {
        const body = this._world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z))
        const shape = RAPIER.ColliderDesc.cuboid(vec.x, vec.y, vec.z)
        .setFriction(0.7) //to stop sudden movement 
        .setRestitution(0.1) // prevents sliding:: no friction

        if (rot) {
            // Convert Euler angles to quaternion
            const quaternion = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(rot.x, rot.y, rot.z)
            );
            
            // Set Rapier body rotation
            body.setRotation(
                new RAPIER.Quaternion(quaternion.x, quaternion.y, quaternion.z, quaternion.w), 
                true
            );
        }

        this._world.createCollider(shape, body)
    }

    createBuilding() {
        const buildingConfigs = building

        buildingConfigs.forEach(config => {
            this.createPhysic(config.vec, config.pos, config.rot || null)
        })
    }

    _CreateCollision(npc) {
        if (this._world) {  // Ensure physics world exists
            if (npc.model) {
                const boundingBox = new THREE.Box3().setFromObject(npc.model);
                const size = boundingBox.getSize(new THREE.Vector3());
                
                // Calculate center of the bounding box
                const center = boundingBox.getCenter(new THREE.Vector3());

                // Create a capsule collider based on the model's dimensions
                const halfHeight = size.y / 2;
                const verticalOffset = 0.3;

                const bodyDesc = RAPIER.RigidBodyDesc.fixed()
                    .setTranslation(
                        center.x, 
                        center.y, 
                        center.z
                    )
                    .setCanSleep(false);

                // Create the rigid body
                const body = this._world.createRigidBody(bodyDesc);

                // Create the collider
                const colliderDesc = RAPIER.ColliderDesc.capsule(
                    size.x / 3,
                    halfHeight / 4,
                );

                colliderDesc.setRestitution(0.1)
                    .setFriction(0.5);

                // Create and attach the collider to the body
                this._world.createCollider(colliderDesc, body);

                // Store the physics body with the NPC
                npc.physicsBody = body;
            }
            
        }
    }
}


class BasicCharacterController {
    constructor(params) {
        this._Init(params)
    }

    _Init(params) {
        this._params = params
        this._camera = params.camera
        this._LoadingManager = params.loadingManager
        this._decceleration = new THREE.Vector3(-5.0, -0.0001, -5.0)
        this._acceleration = new THREE.Vector3(6.5, 0.25, 6.5)
        this._velocity = new THREE.Vector3(0, 0, 0)
        this._position = new THREE.Vector3()

        this._world = params.world
        this._dynamicBodies = params.bodies

        this._animations = {}        
        this._input = new BasicCharacterControlsInput()
        this._stateMachine = new CharacterFSM(
            new BasicCharacterControllerProxy(this._animations))
        this._LoadModels()
    }

    
    _LoadModels() {
        const loader = new FBXLoader(this._LoadingManager)
        loader.setPath("./models/Player/Model/")
        loader.load('player.fbx', (fbx) => {
            fbx.scale.setScalar(0.004)

            fbx.position.set(13, 0, 0)
            const rotationAngle = -Math.PI * 0.5
            fbx.rotation.set(0, rotationAngle, 0)

            this._target = fbx
            this._params.scene.add(this._target)

            if (this._world) {  // Ensure physics world exists
                // Create a capsule collider
                // Estimate capsule dimensions based on the model's bounding box
                const boundingBox = new THREE.Box3().setFromObject(fbx);
                const size = boundingBox.getSize(new THREE.Vector3());
                
                // Capsule parameters
                const halfHeight = size.y / 2;  // Half the height of the model
                
                const verticalOffset = 0.2

                // Create Rapier rigid body description
                const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(
                        fbx.position.x, 
                        fbx.position.y + verticalOffset, 
                        fbx.position.z)
                    .enabledRotations(false, false, false)
                    .setCanSleep(false)
                    .setLinearDamping(0.5)      // Add damping to reduce floating
                    .setGravityScale(1)  
                    ;
    
                // Create the rigid body
                this.body = this._world.createRigidBody(bodyDesc)
    
                // Create capsule collider
                const colliderDesc = RAPIER.ColliderDesc.capsule(
                    (size.x * 228) / 3,
                    (halfHeight * 228) / 4,  // Half height of the capsule
                    // size.z * 2     // Radius of the capsule

                )
                
    
                // Create the collider and attach it to the body
                this._world.createCollider(colliderDesc, this.body);

                const quaternion = new THREE.Quaternion()
                quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationAngle)
                this.body.setRotation(quaternion)
    
                // Store reference if needed
                fbx.userData.physicsBody = this.body;

                this._dynamicBodies.push([fbx, this.body])
            }



            this._mixer = new THREE.AnimationMixer(this._target)

            this._manager = new THREE.LoadingManager()
            this._manager.onLoad = () => {
                this._stateMachine.SetState('idle')
            }

            const _OnLoad = (animName, anim) => {
                const clip = anim.animations[0]
                const action = this._mixer.clipAction(clip)

                this._animations[animName] = {
                    clip: clip,
                    action: action
                }
            }

            const loader = new FBXLoader(this._manager)
            loader.setPath('./models/Player/Animations/')
            loader.load('walk.fbx', (a) => { _OnLoad('walk', a)})
            loader.load('run.fbx', (a) => { _OnLoad('run', a)})
            loader.load('idle.fbx', (a) => { _OnLoad('idle', a)})
            loader.load('leftStrafeWalk.fbx', (a) => {_OnLoad('strafeLeftWalk', a)})
            loader.load('leftStrafeRun.fbx', (a) => {_OnLoad('strafeLeftRun', a)})
            loader.load('rightStrafeWalk.fbx', (a) => {_OnLoad('strafeRightWalk', a)})
            loader.load('rightStrafeRun.fbx', (a) => {_OnLoad('strafeRightRun', a)})
        })
    }

    get Position() {
        return this._position
    }

    get Rotation() {
        if (!this._target) {
            return new THREE.Quaternion()
        }
        return this._target.quaternion
    }
    
    Update(timeInSeconds) {
    if (!this._stateMachine._currentState) {
        return
    }

    this._stateMachine.Update(timeInSeconds, this._input)

    const velocity = this._velocity
    const frameDecceleration = new THREE.Vector3(
        velocity.x * this._decceleration.x,
        velocity.y * this._decceleration.y,
        velocity.z * this._decceleration.z
    )
    frameDecceleration.multiplyScalar(timeInSeconds)
    frameDecceleration.x = Math.sign(frameDecceleration.x) * Math.min(
        Math.abs(frameDecceleration.x), Math.abs(velocity.x))

    frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
        Math.abs(frameDecceleration.z), Math.abs(velocity.z))

    velocity.add(frameDecceleration)

    const controlObject = this._target
    const _Q = new THREE.Quaternion()
    const _A = new THREE.Vector3()
    const _R = controlObject.quaternion.clone()

    const acc = this._acceleration.clone()
    if (this._input._keys.shift) {
        acc.multiplyScalar(2.0)
    }

    const forward = new THREE.Vector3(0, 0, 1)
    forward.applyQuaternion(controlObject.quaternion)
    forward.normalize()

    const right = new THREE.Vector3(1, 0, 0)
    right.applyQuaternion(controlObject.quaternion)
    right.normalize()

    // Initialize movement vector
    const moveVector = new RAPIER.Vector3(0, 0, 0)
    let x = 0
    let z = 0

    // Combine all movement inputs
    if (this._input._keys.forward) {
        x += forward.x
        z += forward.z
    }
    if (this._input._keys.backward) {
        x -= forward.x
        z -= forward.z
    }
    if (this._input._keys.right) {
        x -= right.x
        z -= right.z
    }
    if (this._input._keys.left) {
        x += right.x
        z += right.z
    }

    // Normalize the combined movement vector to maintain consistent speed
    if (x !== 0 || z !== 0) {
        const length = Math.sqrt(x * x + z * z)
        x /= length
        z /= length

        moveVector.x = x * acc.x * timeInSeconds * 10
        moveVector.z = z * acc.z * timeInSeconds * 10
    }

    this.body.setLinvel(moveVector, true)

    if (this._input._keys.mouse) {
        _A.set(0, 1, 0)
        _Q.setFromAxisAngle(_A, this._input._rotationSpeedX * -Math.PI * timeInSeconds * 16.0)
        _R.multiply(_Q)
        this.body.setRotation(_R, true)
        controlObject.quaternion.copy(_R)
    }

    controlObject.quaternion.copy(_R)

    const oldPosition = new THREE.Vector3()
    oldPosition.copy(controlObject.position)

    right.multiplyScalar(velocity.x * timeInSeconds)
    forward.multiplyScalar(velocity.z * timeInSeconds)

    controlObject.position.add(forward)
    controlObject.position.add(right)

    this._position.copy(controlObject.position)

    if (this._mixer) {
        this._mixer.update(timeInSeconds)
    }
}
}


class BasicCharacterControlsInput {
    constructor() {
        this._Init()
    }

    _Init() {
        this._keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            shift: false,
            mouse: false
        }

        this._previousMouse = 0

        document.addEventListener('keydown', (e) => this._onKeyDown(e), false)
        document.addEventListener('keyup', (e) => this._onKeyUp(e), false)

        document.addEventListener('mousedown', (e) => this._onMouseDown(e), false)
        document.addEventListener('mouseup', (e) => this._onMouseUp(e), false)
        document.addEventListener('mousemove', (e) => this._onMouseMove(e), false)
    }

    _onMouseDown(event) {
        if (event.button === 0) {
            this._keys.mouse = true
            this._previousMouse = event.clientX
        }
    }

    _onMouseUp(event) {
        if (event.button === 0) {
            this._keys.mouse = false
        }
    }

    _onMouseMove(event) {
        if (this._keys.mouse) {
            const deltaX = event.clientX - this._previousMouse
            this._previousMouse = event.clientX
            this._rotationSpeedX = deltaX * 0.005
        }
    }

    _onKeyDown(event) {
        switch (event.keyCode) {
            case 87: // w
            this._keys.forward = true
            break
            case 65: // a
            this._keys.left = true
            break
            case 83: // s
            this._keys.backward = true
            break
            case 68: // d
            this._keys.right = true
            break
            case 16: // shift
            this._keys.shift = true
            break
        }
    }

    _onKeyUp(event) {
        switch(event.keyCode) {
            case 87: // w
            this._keys.forward = false
            break
            case 65: // a
            this._keys.left = false
            break
            case 83: // s
            this._keys.backward = false
            break
            case 68: // d
            this._keys.right = false
            break
            case 16: // shift
            this._keys.shift = false
            break
        }
    }
}


class Main {
    constructor() {
        this._Initialize()
    }

    _Initialize() {
        // Canvas Element
        this._canvas = document.querySelector('canvas.webgl')

        // Screen Sizes
        this._sizes = {
            width: window.innerWidth,
            height: window.innerHeight
        }

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            canvas:this._canvas,
            antialias: true
        })
        renderer.setPixelRatio(Math.min(2, devicePixelRatio))
        renderer.setSize(this._sizes.width, this._sizes.height)
        

        this._threejs= new OutlineEffect(renderer)


        

        // Camera setup
        const fov = 60
        const aspectRatio = this._sizes.width / this._sizes.height
        const near = 0.1
        const far = 200
        
        this._camera = new THREE.PerspectiveCamera(fov, aspectRatio, near, far)
        // this._camera.position.set(25, 10, 25)

        this._thirdPersonCamera = new ThirdPersonCamera({
            camera: this._camera
        })

        // Scene
        this._scene = new THREE.Scene()

        const engine = new PhysicsEngine(this._scene);
        engine.init()
        this._world = engine._world
        this._dynamicBodies = engine._dynamicBodies
        // this._physicDebug = engine._debug

        engine.createCollisions()


        this.npcInteract = new NPCInteraction(engine, this._scene)
        this.npcInteract.Init(window, document, this._LoadingManager)



        this.progressBar = document.querySelector('#progress-bar')
        this._LoadingManager = new THREE.LoadingManager()

        this.npcInteract._LoadModels(this._LoadingManager)

        window.transitionManager = new TransitionManager(document, window, this.npcInteract)


        this.bgAudio = new SetAudio('./music/one-evening_by_musicstockproduction.mp3')


        this._LoadingManager.onProgress = (url, loaded, total) =>{
            window.transitionManager._TriggerLoad()
            this.progressBar.value = (loaded / total) * 100 // First 50% of progress bar
        } 
        this._LoadingManager.onLoad = () => {
            document.querySelector('#progress-bar').classList.add('fade-out')
            document.querySelector('#progressLabel').classList.add('fade-out')
            const bottomText = document.querySelector('.bottomText')
            bottomText.style.visibility = 'visible'
            window.addEventListener('click', (e) => {
                const btmText = document.getElementById("btmText")
                btmText.classList.add('fade-out')
                window.transitionManager._TriggerLoadTransition()
                setTimeout(() => {
                    document.querySelector('.progressBar').remove()
                }, 10)
                this.progressBar.remove()
                this.bgAudio.play()
                this._RAF()
            }, {once: true})
        }

        

        const textureLoader = new THREE.TextureLoader(this._LoadingManager)
        const texture = textureLoader.load("./pictures/grass.jpg")

        texture.repeat.set(8, 8);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 50),
            new THREE.MeshStandardMaterial({
                color: 0xffffff,
                map: texture
            })
        )
        floor.rotation.set(-Math.PI/2, 0, 0)
        this._scene.add(floor)

        // this.npcInteract._CreateCollisions()



        document.addEventListener('keydown', (event) => {
            if (this.npcInteract.isTalking) {
          
              if (event.key === 'e') {
                // Check if we are in range of any NPC
                this.npcInteract._HandleChat();
              }
              return; // Prevent other keypresses when talking
            }
          
            if (event.key === 'e' && this.npcInteract.isInRange && !this.npcInteract.isTalking ) {
              this.npcInteract.npcs.forEach(npc => {
                if (this.npcInteract._IsNearNPC(npc, this._player)) {
                //   controls.enabled = false
                  this.npcInteract._StartDialogue(npc); // Start dialogue with the correct NPC
                }
              });
            }
        })

        window.addEventListener('resize', () => {
            this._OnWindowResize()
        }, false)

        window.addEventListener('dblclick', ()=> {
            this._FullScreen()
        })





        window._handleQuestAnswer = (answer) => {
            if (answer === 'yes') {
                window.transitionManager._TriggerTransition(answer)
                this.bgAudio.stop()
            } else {
                this.npcInteract._HandleQuest(answer)
            }
        }
        
        
        
        window.goBack = () => {
            window.transitionManager._TriggerGoBack(this.bgAudio)
        };
        
        
        window.showNextGif = () => {
            this.npcInteract._ShowNextGIF()
        }


        const light = new THREE.AmbientLight(0xffffff, 2)
        this._scene.add(light)

        const cubeLoader = new THREE.CubeTextureLoader(this._LoadingManager) 
        const skyBoxTexture = cubeLoader.load([
            'Textures/Skybox/skybox/px.png',
            'Textures/Skybox/skybox/nx.png',
            'Textures/Skybox/skybox/py.png',
            'Textures/Skybox/skybox/ny.png',
            'Textures/Skybox/skybox/pz.png',
            'Textures/Skybox/skybox/nz.png'
        ],
        () => {
            
        },
        undefined,
        (error) => {
            console.error('Error loading cube texture', error)
        })

        // console.log(this._sizes)
        this._scene.background = skyBoxTexture

        // const plane = new THREE.Mesh(
        //     new THREE.PlaneGeometry(100, 100),
        //     new THREE.MeshStandardMaterial({
        //         color: 0xffffff,
        //     })
        // )
        // plane.rotation.x = -Math.PI*0.5
        // this._scene.add(plane)

        this.clock = new THREE.Clock()

        this._mixers = []
        this._previousRAF = null
    
        this._LoadModel()
        this._LoadAnimatedModel()

        this._player = this._controls._target
    }

    // _Check(){
    //     if (!this.npcInteract.isTalking && !controls.enabled) {
    //       controls.enabled = true; // Re-enable controls
    //     }
    //   }
    

    _LoadAnimatedModel() {
        const params = {
            camera: this._camera,
            scene: this._scene,
            world: this._world,
            bodies: this._dynamicBodies,
            loadingManager: this._LoadingManager
        }

        this._controls = new BasicCharacterController(params)
        
        this._thirdPersonCamera = new ThirdPersonCamera({
            camera: this._camera,
            target: this._controls
        })
    }
    


    _LoadModel() {
        const loader = new GLTFLoader(this._LoadingManager)
        loader.load('models/Building12.glb', (gltf) => {
            this._scene.add(gltf.scene)
        })
    }

    _OnWindowResize() {
        this._sizes.width = window.innerWidth
        this._sizes.height = window.innerHeight

        this._camera.aspect = this._sizes.width / this._sizes.height
        this._camera.updateProjectionMatrix()
        this._threejs.setSize(this._sizes.width, this._sizes.height)
    }

    _FullScreen() {
        const fullScreenElement = document.fullscreenElement || document.webkitFullscreenElement
        if(!fullScreenElement) {
            if (this._canvas.requestFullscreen) {
                this._canvas.requestFullscreen()
            } else if(this._canvas.webkitRequestFullscreen) {
                this._canvas.webkitRequestFullscreen()
            }
        } else {
            if(document.exitFullscreen) {
                document.exitFullscreen()
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen()
            }
        }
    }


    _RAF() {
        const animate = (t) => {
            if (this._previousRAF === null) {
                this._previousRAF = t;
                requestAnimationFrame(animate);
                return;
            }
    
            // Calculate delta time
            const delta = this.clock.getDelta();
            const timeElapsed = t - this._previousRAF;
            const timeElapsedS = timeElapsed * 0.001;
    
            // Cap the physics timestep
            this._world.timestep = Math.min(delta, 0.1);
            
            // Update physics first
            this._world.step();
    
            // Update player and NPC interactions
            if (this._player) {
                this.npcInteract._Update(this._player, delta);
            } else if (this._controls?._target) {
                this._player = this._controls._target;
            }
    
            // Sync physics bodies with meshes
            this._updatePhysicsBodies();
    
            // Update controls and camera before rendering
            if (this._controls) {
                this._controls.Update(timeElapsedS);
            }
    
            // Update animations
            if (this._mixers) {
                this._mixers.forEach(mixer => mixer.update(timeElapsedS));
            }
    
            // Update camera last to ensure it has the latest positions
            if (this._thirdPersonCamera) {
                this._thirdPersonCamera.Update(timeElapsedS);
            }
    
            // Debug visualization
            // this._physicDebug.update();
    
            // Render
            this._threejs.render(this._scene, this._camera);
    
            this._previousRAF = t;
            requestAnimationFrame(animate);
        };
    
        requestAnimationFrame(animate);
    }
    
    // Separate method for physics body updates
    _updatePhysicsBodies() {
        const verticalOffset = -0.32;
        this._dynamicBodies.forEach(([mesh, body]) => {
            const translation = body.translation();
            const rotation = body.rotation();
    
            mesh.position.set(
                translation.x,
                translation.y + verticalOffset,
                translation.z
            );
            mesh.quaternion.copy(rotation);
        });
    }

    // _Update(deltaTime) {
    //     // Step the physics simulation
    //     // this._world.step();

    //     // Sync character body with 3D model if needed
    //     if (this._characterBody && this._target) {
    //         const position = this._characterBody.translation();
    //         this._target.position.set(position.x, position.y, position.z);
    //     }
    // }

    _Step(timeElapsed) {
        const timeElapsedS = timeElapsed * 0.001
        if (this._mixers) {
            this._mixers.map(m => m.update(timeElapsedS))
        }

        if (this._controls) {
            this._controls.Update(timeElapsedS)
        }   

        // this._Update(timeElapsedS)

        this._thirdPersonCamera.Update(timeElapsedS)
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function initRapier() {
    try {
        // Explicitly check if RAPIER exists
        if (typeof RAPIER === 'undefined') {
            console.error('RAPIER is not loaded');
            throw new Error('RAPIER library not found');
        }
        
        await RAPIER.init();
    } catch (error) {
        console.error('Error initializing Rapier:', error);
        throw error;
    }
}

async function main() {
    try {
        await initRapier();
        const mainInstance = new Main();
        return mainInstance;
    } catch (error) {
        console.error('Main initialization error:', error);
        throw error;
    }
} 

let _APP = null


window.addEventListener('DOMContentLoaded', async () => {  
    try {
        _APP = await main();
    } catch (error) {
        console.error('DOMContentLoaded initialization error:', error);
    }
});