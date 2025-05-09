transpiler\babel-inula-next-core\test\classComponent


/*
 * Copyright (c) 2024 Huawei Technologies Co.,Ltd.
 *
 * openInula is licensed under Mulan PSL v2.
 * You can use this software according to the terms and conditions of the Mulan PSL v2.
 * You may obtain a copy of Mulan PSL v2 at:
 *
 *          http://license.coscl.org.cn/MulanPSL2
 *
 * THIS SOFTWARE IS PROVIDED ON AN "AS IS" BASIS, WITHOUT WARRANTIES OF ANY KIND,
 * EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO NON-INFRINGEMENT,
 * MERCHANTABILITY OR FIT FOR A PARTICULAR PURPOSE.
 * See the Mulan PSL v2 for more details.
 */

import { describe, expect, it } from 'vitest';
import { getMacro } from '../mock';
import { CLS_COMPONENT, COMPONENT } from '../../src/constants';
describe('class view generation', () => {
  // it('should be class component', () => {
  //   const code = getMacro(/*js*/ `
  //   import { Component } from 'react';
  //   class Comp extends Component{
  //     constructor() {
  //       super();
  //     }
  //     a = 123;
    
  //     testfun = (abcd) => {
        
  //     };
  //   }
  //   `);
  //   expect(code).toBe(CLS_COMPONENT);
  // });

  it('should be NOT class component', () => {
    const code = getMacro(/*js*/ `
      Component((a, b, c, d) => {})
    `);
    expect(code).not.toBe(CLS_COMPONENT);
    expect(code).toBe(COMPONENT);
  });


});
