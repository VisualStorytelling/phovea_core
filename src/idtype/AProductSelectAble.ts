/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */
/**
 * Created by Samuel Gratzl on 04.08.2014.
 */

import {IEvent, IEventListener} from '../event';
import {Range, RangeLike, parse} from '../range';
import {SelectOperation, defaultSelectionType, fillWithNone, asSelectOperation} from './IIDType';
import ASelectAble, {ISelectAble} from './ASelectAble';
import ProductIDType from './ProductIDType';

export interface IProductSelectAble extends ISelectAble {
  producttype: ProductIDType;
  productSelections(type?: string): Promise<Range[]>;

  selectProduct(range: RangeLike[], op?: SelectOperation): Promise<Range[]>;
  selectProduct(type: string, range: RangeLike[], op?: SelectOperation): Promise<Range[]>;
}

export abstract class AProductSelectAble extends ASelectAble {
  private numProductSelectListeners = 0;

  private productSelectionListener = (event: IEvent, index: number, type: string) => {
    const cells = this.producttype.productSelections(type);
    if (cells.length === 0) {
      this.fire(ProductIDType.EVENT_SELECT_PRODUCT, type, []);
      this.fire(`${ProductIDType.EVENT_SELECT_PRODUCT}-${type}`, []);
      return;
    }

    this.ids().then((ids: Range) => {
      const act = cells.map((c) => ids.indexOf(c)).filter((c) => !c.isNone);
      if (act.length === 0) {
        return;
      }
      //ensure the right number of dimensions
      act.forEach((a) => fillWithNone(a, ids.ndim));

      this.fire(ProductIDType.EVENT_SELECT_PRODUCT, type, act);
      this.fire(`${ProductIDType.EVENT_SELECT_PRODUCT}-${type}`, act);
    });
  }

  abstract get producttype(): ProductIDType;

  on(events: string|{[key: string]: IEventListener}, handler?: IEventListener) {
    if (typeof events === 'string' && (events === 'select' || events === 'selectProduct' || events.slice(0, 'select-'.length) === 'select-')) {
      this.numProductSelectListeners++;
      if (this.numProductSelectListeners === 1) {
        this.producttype.on('selectProduct', this.productSelectionListener);
      }
    }
    return super.on(events, handler);
  }

  off(events: string|{[key: string]: IEventListener}, handler?: IEventListener) {
    if (typeof events === 'string' && (events === 'select' || events === 'selectProduct' || events.slice(0, 'select-'.length) === 'select-')) {
      this.numProductSelectListeners--;
      if (this.numProductSelectListeners === 0) {
        this.producttype.off('selectProduct', this.productSelectionListener);
      }
    }
    return super.off(events, handler);
  }

  productSelections(type = defaultSelectionType): Promise<Range[]> {
    return this.ids().then((ids: Range) => {
      const cells = this.producttype.productSelections(type);
      const act = cells.map((c) => ids.indexRangeOf(c)).filter((c) => !c.isNone);
      //ensure the right number of dimensions
      act.forEach((a) => fillWithNone(a, ids.ndim));
      return act;
    });
  }

  selectProduct(range: RangeLike[], op?: SelectOperation): Promise<Range[]>;
  selectProduct(type: string, range: RangeLike[], op?: SelectOperation): Promise<Range[]>;
  selectProduct() {
    const a = Array.from(arguments);
    const type = (typeof a[0] === 'string') ? a.shift() : defaultSelectionType,
      range = a[0].map(parse),
      op = asSelectOperation(a[1]);
    return this.selectProductImpl(range, op, type);
  }

  private selectProductImpl(cells: Range[], op = SelectOperation.SET, type: string = defaultSelectionType): Promise<Range[]> {
    return this.ids().then((ids: Range) => {
      cells = cells.map((c) => ids.preMultiply(c));
      return this.producttype.select(type, cells, op);
    });
  }

  /**
   * clear the specific selection (type) and dimension
   */
  clear(): Promise<Range[]>;
  clear(type: string): Promise<Range[]>;
  clear(dim: number): Promise<Range[]>;
  clear(dim: number, type: string): Promise<Range[]>;
  clear() {
    const a = Array.from(arguments);
    if (typeof a[0] === 'number') {
      a.shift();
    }
    const type = (typeof a[0] === 'string') ? a[0] : defaultSelectionType;
    return this.selectProductImpl([], SelectOperation.SET, type || defaultSelectionType);
  }
}

export default AProductSelectAble;
