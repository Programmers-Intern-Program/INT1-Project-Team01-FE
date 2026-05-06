import Phaser from "phaser";
import { OfficeScene } from "./scenes/OfficeScene";

export function createOfficeGame(parent: HTMLElement): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: "#dff1f6",
    pixelArt: true,
    banner: false,
    disableContextMenu: true,
    scene: [OfficeScene],
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
  });
}
