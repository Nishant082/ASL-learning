import NPCInteraction from "./interaction"

export default class NPC {
    constructor(id, name, sign, position, rotation, dialogue, gifs, interaction) {
        this.id = id
        this.name = name
        this.sign = sign
        this.position = position
        this.rotation = rotation
        this.dialogue = dialogue
        this.gifs = gifs
        this.currentMessageIndex = 0
        this.interaction = interaction
    }
  
      // In NPC class
    startDialogue() {
      this.interaction._DisplayDialogueBox(this);
    }
  
  
    showNextDialogue() {
      this.currentMessageIndex++
      if (this.currentMessageIndex >= this.dialogue.length) {
        this.interaction._EndDialogue(this)
      } else {
        this.interaction._DisplayDialogueBox(this)
      }
    }
  
    resetDialogue() {
      this.currentMessageIndex = 0
    }
  }
  