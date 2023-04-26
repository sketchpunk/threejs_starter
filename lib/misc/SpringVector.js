

import {quat, vec4} from 'gl-matrix';

// #region MATH OPERATORS
/** Copy one array to another */
function copy(size: number, a: Array<number>, b: Array<number>): void {
  for (let i = 0; i < size; i++) {
    a[i] = b[i];
  }
}

/** Zero out an array */
function zero(a: Array<number>): void {
  for (let i = 0; i < a.length; i++) {
    a[i] = 0;
  }
}

/** Is all values in an array just zero */
function isZeroed(ary: Array<number>): boolean {
  for (const v of ary) {
    if (v !== 0) {
      return false;
    }
  }
  return true;
}

/** Squared distance between two vectors */
function sqrDist(size: number, a: Array<number>, b: Array<number>): number {
  let rtn = 0;
  for (let i = 0; i < size; i++) {
    rtn += (a[i] - b[i]) ** 2;
  }
  return rtn;
}

/** Squared length of a vector */
function sqrLen(a: Array<number>): number {
  let rtn = 0;
  for (const v of a) {
    rtn += v ** 2;
  }
  return rtn;
}
// #endregion

/** Spring physics on vector values using 'implicit euler spring' algorithm */
export class SpringVector {
  // #region MAIN
  _osc_ps: number = Math.PI * 2; // Oscillation per Second : How many Cycles (Pi*2) per second.
  _damping: number = 1; // How much to slow down  : Value between 0 and 1, 1 creates critical damping.
  _epsilon: number = 0.0001; // Min value to be consider a value as zero
  _value: Array<number>; // Current spring value
  _target: Array<number>; // Target spring value
  _velocity: Array<number>; // Current spring velocity
  _compSize: number = 3; // Size of vector, usually known as component size

  constructor(size: number = 3) {
    this._compSize = size;
    this._value = new Array<number>(size).fill(0);
    this._target = new Array<number>(size).fill(0);
    this._velocity = new Array<number>(size).fill(0);
  }

  /** Run the spring once per frame by passing in delta time */
  update(dt: number): boolean {
    if (
      isZeroed(this._velocity) &&
      sqrDist(this._compSize, this._target, this._value) === 0
    ) {
      return false;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    if (
      sqrLen(this._velocity) < this._epsilon &&
      sqrDist(this._compSize, this._target, this._value) < this._epsilon
    ) {
      zero(this._velocity);
      copy(this._compSize, this._value, this._target);
      return true;
    }

    // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    const friction = 1.0 + 2.0 * dt * this._damping * this._osc_ps;
    const dt_osc = dt * this._osc_ps ** 2;
    const dt2_osc = dt * dt_osc;
    const det_inv = 1.0 / (friction + dt2_osc);

    for (let i = 0; i < this._compSize; i++) {
      this._velocity[i] =
        (this._velocity[i] + dt_osc * (this._target[i] - this._value[i])) *
        det_inv;

      this._value[i] =
        (friction * this._value[i] +
          dt * this._velocity[i] +
          dt2_osc * this._target[i]) *
        det_inv;
    }

    return true;
  }
  // #endregion

  // #region Target & Value
  getTarget(): Array<number> {
    return this._target.slice();
  }
  setTarget(v: Array<number>): this {
    copy(this._compSize, this._target, v);
    return this;
  }

  getValue(): Array<number> {
    return this._value.slice();
  }

  /** When dealing with quaternions, need the value vector to be normalized */
  getNormValue(): Array<number> {
    const rtn = this._value.slice();
    let len = sqrLen(rtn);
    if (len > 0) {
      len = 1 / Math.sqrt(len);
    }

    for (let i = 0; i < this._compSize; i++) {
      rtn[i] *= len;
    }
    return rtn;
  }
  // #endregion

  // #region Oscillation & Damping
  setOscPerSec(sec: number): this {
    this._osc_ps = Math.PI * 2 * sec;
    return this;
  }
  setDamping(d: number): this {
    this._damping = d;
    return this;
  }

  // Damp Time, in seconds to damp. So damp 0.5 for every 2 seconds.
  // With the idea that for every 2 seconds, about 0.5 damping has been applied
  // IMPORTANT : Need to set OSC Per Sec First
  dampRadio(damp: number, sec: number): this {
    this._damping = Math.log(damp) / (-this._osc_ps * sec);
    return this;
  }

  // Reduce oscillation by half in X amount of seconds
  // IMPORTANT : Need to set OSC Per Sec First
  dampHalflife(sec: number): this {
    this._damping = 0.6931472 / (this._osc_ps * sec);
    return this;
  }

  // Critical damping with a speed control of how fast the cycle to run
  dampExpo(sec: number): this {
    this._osc_ps = 0.6931472 / sec; // -Log(0.5) but in terms of OCS its 39.7 degrees over time
    this._damping = 1;
    return this;
  }
  // #endregion

  // #region Resetting
  reset(v: Array<number> | null = null): this {
    zero(this._velocity);
    if (v != null) {
      copy(this._compSize, this._value, v);
      copy(this._compSize, this._target, v);
    } else {
      zero(this._value);
      zero(this._target);
    }
    return this;
  }
  // #endregion

  // #region Quaternion Usage

  /** Identity is used to reset a quaternions */
  quatReset(v: Array<number> | null = null): this {
    zero(this._velocity);
    if (v != null) {
      copy(this._compSize, this._value, v);
      copy(this._compSize, this._target, v);
    } else {
      quat.identity(this._value);
      quat.identity(this._target);
    }
    return this;
  }

  // Special target setting, Need to check if the target is on the
  // same hemisphere as the value, if not it needs to be negated to be used
  // correctly
  setQuatTarget(q: Array<number>): this {
    quat.copy(this._target, q);
    if (quat.dot(this._value, this._target) < 0) {
      vec4.negate(this._target, this._target);
    }
    return this;
  }
  // #endregion
}
