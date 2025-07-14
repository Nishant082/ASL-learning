import npcData from './npcs.json'
import NPC from './npc'
import { AnimationMixer, LoopRepeat, Quaternion } from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

export default class NPCInteraction {
    constructor(world, scene) {
        this._scene = scene
        this._physicsWorld = world
        this.interaction_dist = 0.7
        this.isInRange = false;
        this.isTalking = false;
        this.enabled = false
        this.npcs = []
        this.modelLoaded = false
    }

    Init(window, document) {
        this.window = window
        this.domElement = document
        this.canvas = document.querySelector('.webgl')
        this._HandleListeners()
        this._Initialize()
    }

    _Initialize() {
        npcData.forEach(element => {
            const npc = new NPC(
                element.id,
                element.name,
                element.sign,
                element.position,
                element.rotation,
                element.dialogues,
                element.gifs,
                this
            )
            this.npcs.push(npc)
        });
    }

    _HandleListeners() {
        this.bounceIcon = this.domElement.querySelector('.bounceIcon');
        this.bounceIcon.addEventListener('click', this._HandleChat.bind(this));  // Bind 'this' to the method
    }
    
    _HandleChat() {
        this.npcs.forEach(npc => {
            if (this._IsNearNPC(npc)) {
                this._ShowNextDialogue(npc); // Show next dialogue for the NPC
            }
        })
    }

    _CheckProximity(player) {
        this.playerPosition = player.position;
        let isNearAnyNPC = false;
        
        this.npcs.forEach(npc => {
            const distance = this.playerPosition.distanceTo(npc.position);
        
            if (distance < this.interaction_dist) {
            if (!this.isInRange) {
                this.isInRange = true;
                this._ShowTalkPrompt(); // Show talk prompt when in range
            }
            isNearAnyNPC = true; // Mark that player is near at least one NPC
            this.nearNPC = npc
            }
        });
        if (!isNearAnyNPC && this.isInRange) {
            this.isInRange = false;
            this.nearNPC = null
            this._HideTalkPrompt(); // Hide the prompt when out of range
        }
    }

    
    _IsNearNPC(npc) {
        const distance = this.playerPosition.distanceTo(npc.position);
        return distance < this.interaction_dist; // Returns true if player is close enough
    }

    _ShowTalkPrompt() {
        const prompt = this.domElement.getElementById('talkPrompt');
        prompt.style.display = 'block';  // Show the prompt
    } 
      
    _HideTalkPrompt() {
        const prompt = this.domElement.getElementById('talkPrompt');
        prompt.style.display = 'none';  // Hide the prompt
    }

    _StartDialogue(npc) {
        this.isTalking = true
        npc.startDialogue();  // Use NPC's start dialogue method
        this._HideTalkPrompt();  // Hide the prompt once dialogue starts
    }

    // Show next dialogue message
    _ShowNextDialogue(npc) {
        npc.showNextDialogue();  // Call the NPC's method to show the next message
        if (npc.currentMessageIndex === 2) {
            this.enabled = true
            this._ShowQuestConfirmation(); // Example: Show quest confirmation
        } else {
            if (this.enabled) {
                this._HideQuestConfirmation()
            }
        }
    }

    _ShowQuestConfirmation() {
        const confirmationPrompt = this.domElement.getElementById('questConfirmation');
        confirmationPrompt.style.display = 'flex';  // Show the prompt
    }

    _HideQuestConfirmation() {
        const confirmationPrompt = this.domElement.getElementById('questConfirmation');
        confirmationPrompt.style.display = 'none';  // Show the prompt
    }

    _DisplayDialogueBox(npc) {
        const chats = this.domElement.getElementById('chats');
        const dialogueBox = this.domElement.getElementById('dialogueBox')
        dialogueBox.style.display = 'block';  // Show the dialogue box
        chats.textContent = npc.dialogue[npc.currentMessageIndex]; // Show the current dialogue message
    }

    _StartQuestTransition() {
        // Hide the 3D scene
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }
      
        // Hide the dialogue box
        const dialogueBox = this.domElement.getElementById('dialogueBox');
        if (dialogueBox) {
          dialogueBox.style.display = 'none';
        }
      
        // Show the quest UI
        const questUI = this.domElement.getElementById('questUI');
        const performText = this.domElement.querySelector('.performPrediction')
        const headerText = this.domElement.querySelector('.headerText')
        if (questUI) {
          questUI.style.display = 'block';
          performText.innerText = this.nearNPC.sign
          headerText.innerText = "Learning ASL Gesture: " + this.nearNPC.sign
          this._HandleNPCSpecificLoad(questUI)
        } else {
          console.error("Quest UI element not found!");
        }
    }

    _HandleNPCSpecificLoad(element) {
        this.gifs = this.nearNPC.gifs
        this.currentGifIndex = 0
        this._LoadGifs()
    }

    _LoadGifs() {
        this.gifContainer = this.domElement.querySelector("#carousel")
        this.gifs.forEach((fileName, index) => {
            const gif = document.createElement('img');
              gif.src = fileName;
              gif.alt = 'GIF';
              gif.classList.add('gif-slide');
              gif.style.display = 'none';  // Make them hidden initially
              this.gifContainer.appendChild(gif);

              if (index === 0) {
                  gif.style.display = 'block';  // Show the first GIF
              }
        })
    }

    _ShowNextGIF() {
        const slides = document.querySelectorAll('.gif-slide')
        slides[this.currentGifIndex].style.display = 'none'

        this.currentGifIndex = (this.currentGifIndex + 1) % this.gifs.length

        if (this.currentGifIndex === 0) {
            this.currentGifIndex = 1
        }

        slides[this.currentGifIndex].style.display = 'block'
    }

    _CloseQuest() {
        if (this.gifContainer) {
            this.gifContainer.innerHTML = ''
            this.currentGifIndex = 0
        }
        const performText = this.domElement.querySelector('.performPrediction')
        performText.style.color = 'red'

        // Reset MediaPipe module if necessary
        if (typeof MediaPipe !== 'undefined') {
            // Reset any module state or perform cleanup, if necessary.
            MediaPipe = undefined;
        }

        // Optionally reset other UI states
        this._EndDialogue();  // End the dialogue when declining the quest
    }

    _HandleQuest(answer) {
        const confirmationPrompt = this.domElement.getElementById('questConfirmation');
        confirmationPrompt.style.display = 'none';  // Hide the prompt

        if (answer === 'yes') {
            this._StartQuestTransition();  // Start the quest transition
        } else {
            this.nearNPC.currentMessageIndex++;
            this._DisplayDialogueBox(this.nearNPC);  // Continue dialogue
        }
    }

    _EndDialogue() {
        this.isTalking = false;  // Set talking state to false
        
        this.nearNPC.resetDialogue()
        const dialogueBox = document.getElementById('dialogueBox');
        dialogueBox.style.display = 'none';  // Hide the dialogue box
        this._ShowTalkPrompt();  // Show the talk prompt again
    }

    _LoadModels(LoadingManager) {
        const loader = new FBXLoader(LoadingManager)
        const animationLoader = new FBXLoader(LoadingManager)
        const mixer = new AnimationMixer()

        this.npcs.forEach(npc => {
            const modelPath = `./models/NPCs/Models/${npc.id}.fbx`
            const animationPath = `./models/NPCs/Animations/${npc.id}.fbx`

            loader.load(
                modelPath,
                (object) => {
                    object.scale.setScalar(0.00175)

                    npc.model = object
                    npc.model.position.set(npc.position.x, npc.position.y, npc.position.z)
                    npc.model.rotation.set(npc.rotation.x, npc.rotation.y, npc.rotation.z)

                    
                    this._scene.add(npc.model)
                    
                    this._physicsWorld._CreateCollision(npc)

                    animationLoader.load(
                        animationPath,
                        (animationObject) => {
                            // Assuming the first animation clip is the one you want
                            const animationClip = animationObject.animations[0]
                            
                            // Create an animation action
                            const animationAction = mixer.clipAction(animationClip, npc.model)
                            
                            // Play the animation indefinitely
                            animationAction.setLoop(LoopRepeat)
                            animationAction.play()
                        }
                    )

                }
            )
        })
        this._animationMixer = mixer
        this.modelLoaded = true
    }

    _Update(player, deltaTime) {
        if (this._animationMixer) {
            this._animationMixer.update(deltaTime)
        }
        this._CheckProximity(player)
    }
}