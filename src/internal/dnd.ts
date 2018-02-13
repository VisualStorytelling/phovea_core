/**
 * Created by Samuel Gratzl on 27.12.2016.
 */


import {uniqueId} from './unique';

/**
 * utility for drag-n-drop support
 * @param e
 * @param typesToCheck
 * @returns {any}
 */
export function hasDnDType(e: DragEvent, ...typesToCheck: string[]) {
  const available: any = e.dataTransfer.types;

  /*
   * In Chrome datatransfer.types is an Array,
   * while in Firefox it is a DOMStringList
   * that only implements a contains-method!
   */
  if (typeof available.indexOf === 'function') {
    return typesToCheck.some((type) => available.indexOf(type) >= 0);
  }
  if (typeof available.includes === 'function') {
    return typesToCheck.some((type) => available.includes(type));
  }
  if (typeof available.contains === 'function') {
    return typesToCheck.some((type) => available.contains(type));
  }
  return false;
}


/**
 * helper storage for dnd in edge since edge doesn't support custom mime-types
 * @type {Map<number, {[p: string]: string}>}
 */
const dndTransferStorage = new Map<number, { [key: string]: string }>();

function isEdgeDnD(e: DragEvent) {
  return dndTransferStorage.size > 0 && hasDnDType(e, 'text/plain');
}

/**
 * checks whether it is a copy operation
 * @param e
 * @returns {boolean|RegExpMatchArray}
 */
export function copyDnD(e: DragEvent) {
  const dT = e.dataTransfer;
  return Boolean((e.ctrlKey && dT.effectAllowed.match(/copy/gi)) || (!dT.effectAllowed.match(/move/gi)));
}

/**
 * updates the drop effect accoriding to the current copyDnD state
 * @param e
 */
export function updateDropEffect(e: DragEvent) {
  const dT = e.dataTransfer;
  if (copyDnD(e)) {
    dT.dropEffect = 'copy';
  } else {
    dT.dropEffect = 'move';
  }
}

export type IDragEffect = 'none' | 'copy' | 'copyLink' | 'copyMove' | 'link' | 'linkMove' | 'move' | 'all';

export interface IDragStartResult {
  effectAllowed: IDragEffect;
  data: { [mimeType: string]: string };
}

export interface IDropResult {
  effect: IDragEffect;
  data: { [mimeType: string]: string };
}

/**
 * add drag support for the given element
 * @param {HTMLElement} node
 * @param {() => IDragStartResult} onDragStart callback to compute the payload an object of mime types
 * @param {boolean} stopPropagation whether to stop propagation in case of success
 */
export function dragAble(node: HTMLElement, onDragStart: () => IDragStartResult, stopPropagation: boolean = false) {
  const id = uniqueId('edgeDragHelper');
  node.draggable = true;
  node.addEventListener('dragstart', (e) => {
    node.classList.add('phovea-dragging');
    const payload = onDragStart();
    e.dataTransfer.effectAllowed = payload.effectAllowed;

    if (stopPropagation) {
      e.stopPropagation();
    }

    const keys = Object.keys(payload.data);
    const allSucceded = keys.every((k) => {
      try {
        e.dataTransfer.setData(k, payload.data[k]);
        return true;
      } catch (e) {
        return false;
      }
    });
    if (allSucceded) {
      return;
    }
    //compatibility mode for edge
    const text = payload.data['text/plain'] || '';
    e.dataTransfer.setData('text/plain', `${id}${text ? `: ${text}` : ''}`);
    dndTransferStorage.set(id, payload.data);
  });
  node.addEventListener('dragend', (e) => {
    node.classList.remove('phovea-dragging');
    if (stopPropagation) {
      e.stopPropagation();
    }
    if (dndTransferStorage.size > 0) {
      //clear the id
      dndTransferStorage.delete(id);
    }
  });
  node.addEventListener('dragexit', (e) => {
    node.classList.remove('phovea-dragging');
    if (stopPropagation) {
      e.stopPropagation();
    }
  });
}

/**
 * add dropable support for the given node
 * @param {HTMLElement} node
 * @param {string[]} mimeTypes mimeTypes to look for
 * @param {(result: IDropResult, e: DragEvent) => boolean} onDrop callback when dropped, returns true if the drop was successful
 * @param {(e: DragEvent) => void} onDragOver optional drag over handler, e.g. for special effects
 * @param {boolean} stopPropagation flag if the event propagation should be stopped in case of success
 */
export function dropAble(node: HTMLElement, mimeTypes: string[], onDrop: (result: IDropResult, e: DragEvent) => boolean, onDragOver: null|((e: DragEvent)=> void) = null, stopPropagation: boolean = false) {
  node.addEventListener('dragenter', (e) => {
    //var xy = mouse($node.node());
    if (hasDnDType(e, ...mimeTypes) || isEdgeDnD(e)) {
      node.classList.add('phovea-dragover');
      if (stopPropagation) {
        e.stopPropagation();
      }
      //sounds good
      return false;
    }
    //not a valid mime type
    node.classList.remove('phovea-dragover');
    return;
  });
  node.addEventListener('dragover', (e) => {
    if (hasDnDType(e, ...mimeTypes) || isEdgeDnD(e)) {
      e.preventDefault();
      updateDropEffect(e);
      node.classList.add('phovea-dragover');

      if (stopPropagation) {
        e.stopPropagation();
      }
      if (onDragOver) {
        onDragOver(e);
      }
      //sound good
      return false;
    }
    return;
  });
  node.addEventListener('dragleave', (evt) => {
    (<HTMLElement>evt.target).classList.remove('phovea-dragover');
  });
  node.addEventListener('drop', (e) => {
    e.preventDefault();
    if (stopPropagation) {
      e.stopPropagation();
    }
    const effect = <IDragEffect>e.dataTransfer.effectAllowed;

    node.classList.remove('phovea-dragover');
    {
      const cleanup = <HTMLElement>node.ownerDocument.querySelector('.phovea-dragging');
      if (cleanup) {
        cleanup.classList.remove('phovea-dragging');
      }
    }
    if (isEdgeDnD(e)) {
      const base = e.dataTransfer.getData('text/plain');
      const id = parseInt(base.indexOf(':') >= 0 ? base.substring(0, base.indexOf(':')) : base, 10);
      if (dndTransferStorage.has(id)) {
        const data = dndTransferStorage.get(id);
        dndTransferStorage.delete(id);
        return !onDrop({effect, data}, e);
      }
      return;
    }
    if (hasDnDType(e, ...mimeTypes)) {
      const data: any = {};
      //selects the data contained in the data transfer
      mimeTypes.forEach((mime) => {
        const value = e.dataTransfer.getData(mime);
        if (value !== '') {
          data[mime] = value;
        }
      });
      return !onDrop({effect, data}, e);
    }
    return;
  });
}
