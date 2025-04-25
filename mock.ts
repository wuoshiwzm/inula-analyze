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

import { type NodePath } from '@babel/core';
import { transform as transformWithBabel } from '@babel/core';
import generate from '@babel/generator';
import { types as t } from '@openinula/babel-api';
import plugin from '../src';
import { getMacroType, getClsType } from '../src/utils';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

export function genCode(ast: t.Node | null) {

  console.log('ast is :::', ast);

  if (!ast) {
    throw new Error('ast is null');
  }
  return generate(ast).code;
}

export function transform(code: string) {
  return transformWithBabel(code, {
    presets: [plugin],
    filename: 'test.tsx',
  })?.code;
}

// 定义测试函数
export function getMacro(code: string) {
  // 解析代码字符串为AST
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'], // 根据你的代码类型添加插件
  });

  const res: string | null = '';





  traverse(ast, {
    CallExpression(path) {



      // console.log('path >>>>>>>>>>>>>>>>>>>>', path);


      const fnNode = path.get('arguments')[0];

      if (fnNode.isFunctionExpression() || fnNode.isArrowFunctionExpression()) {
        const params = fnNode.get('params');
        

        // console.log(params);

        params.forEach(param => {
          console.log('Parameter:', param.node.name);
        });



        Object.keys(params).forEach((k) => {
          console.log('Parameter>>>>>>>>>>>>>>>>>', params[k].node);
        });





        // params.forEach(param => {
        //   console.log('Parameter:', param.node.name);
        // });

        // console.log(params);
        
      }

      // console.log('fnNode:::::::::::::::::::::::::::::::::::::::::::::', path.get('arguments')[0]);
      // const result = getMacroType(path);
      // if(res  === ''){
      //   res = result;
      // }

      // if (fnNode.isFunctionExpression() || fnNode.isArrowFunctionExpression()) {
        // const params = fnNode.get('params');
        // console.log('params::::::', params);
        // params.forEach(param => {
        //   console.log('Parameter:', param.node.name);
        // });

        // params.forEach(param => {
        //   console.log('Parameter:', param.node.name);
        // });
      // }




    },
    ClassDeclaration(path) {

      const fnNode = path.get('arguments')[0];



      if (fnNode.isFunctionExpression() || fnNode.isArrowFunctionExpression()) {
        const params = fnNode.get('params');
        params.forEach(param => {
          console.log('Parameter:::::::::::::', param.node.name);
        });
      }
      

      // const result = getClsType(path);
      // 
      // 确保我们只处理最外层的类声明
      // if (!path.parentPath || path.parentPath.type !== 'Program') {
      //   return;
      // }

      // if(res  === ''){
      //   res = result;
      // }
      // console.log('path.parentPath.type::', path.parentPath.type, result);
    },
  });

  return res;
}


 
