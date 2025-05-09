packages\transpiler\babel-inula-next-core\test\test.js



import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { Component } from 'react';

// 定义组件类型常量
const CLASS_COMPONENT = 'CLASS_COMPONENT';
const FUNCTION_COMPONENT = 'FUNCTION_COMPONENT';

// 定义判断函数
function getComponentType(path) {
  if (t.isClassDeclaration(path.node)) {
    // 检查是否继承自Component
    if (path.node.superClass && t.isIdentifier(path.node.superClass) && path.node.superClass.name === 'Component') {
      return CLASS_COMPONENT;
    }
  } else if (t.isCallExpression(path.node) && t.isIdentifier(path.node.callee) && path.node.callee.name === 'Component') {
    return FUNCTION_COMPONENT;
  }
  return null;
}

// 定义测试函数
function testComponentType(code) {
  // 解析代码字符串为AST
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'], // 根据你的代码类型添加插件
  });

  // 定义访问者对象
  const visitor = {
    ClassDeclaration(path) {
      const componentType = getComponentType(path);
      if (componentType === CLASS_COMPONENT) {
        console.log('This is a class component.');
      }
    },
    CallExpression(path) {
      const componentType = getComponentType(path);
      if (componentType === FUNCTION_COMPONENT) {
        console.log('This is a function component.');
      }
    },
  };

  // 使用traverse方法遍历AST
  traverse.default(ast, visitor);
}

// 示例测试
testComponentType('class MyClassComponent extends Component { render() { return <div />; } }');
testComponentType('const MyFunctionComponent = Component(() => { return <div />; });');




class Comp extends Component{
  constructor() {
    super();
  }
  a = 123;

  testfun = () => {
    
  };
}

export default Comp;
