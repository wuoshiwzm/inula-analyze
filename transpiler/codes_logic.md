



#  1. 函数组件生成 IR


##  1.1  函数组件生成 IR 入口

![](http://image.huawei.com/tiny-lts/v1/images/mdstorm/3c4cdfb436c25d489f2fbff13799e80f_1124x460.png)

```
1. transformNode()
// 函数组件 生成 IR

2. getMacroType(path)
  // 获取类型

2.1 // Component(() => {})
2.2 // Hook(() => {})

3. extractFnFromMacro(path, type);
// 获取节点

... ...
// 生成 IR root
```


`babel-inula-next-core\src\plugin.ts`

```javascript
/**
 * 函数组件 生成 IR
 */
function transformNode(
  path: NodePath<t.CallExpression>,
  htmlTags: string[],
  state: PluginState,
  hoist: (node: t.Statement | t.Statement[]) => void
) {

  // 如果已经编译，则跳过
  if (ALREADY_COMPILED.has(path)) return false;

  // 获取类型 函数组件 ｜ 勾子
  const type = getMacroType(path);

  // type 非空时表示  path 代码为函数组件：Component(()=>{}) 或 勾子：Hook(() => {})
  if (type) {

    // 1. 函数组件 
    let componentNode;
    if(type === COMPONENT){

      // 生成函数组件节点，对应普通函数 和 箭头函数
      // NodePath<t.FunctionExpression> | NodePath<t.ArrowFunctionExpression>
      componentNode = extractFnFromMacro(path, type);
    }else{
      // todo...  当是 勾子时 应该怎么办？

    }
    
    // 2. 当父节点是一个声明时，获取变量名称
    // try to get the component name, when parent is a variable declarator
    let name = '';
    if (path.parentPath.isVariableDeclarator()) {
      const lVal = path.parentPath.get('id');
      if (lVal.isIdentifier()) {
        name = lVal.node.name;
      } else {
        console.error(`${type} macro must be assigned to a variable`);
      }
    }

    // 3. 生成 IR root
    const [root, bitManager] = analyze(type, name, componentNode, {
      htmlTags,
    });
    const resultNode = generate(root, bitManager, hoist);
    recordComponentInState(state, name, root);
    replaceWithComponent(path, resultNode);
    return true;
  }

  ALREADY_COMPILED.add(path);
  return false;
}

```


## 1.2 返回函数组件节点

`packages\transpiler\babel-inula-next-core\src\utils.ts   工具类`

判断为 函数组件/类组件/勾子函数
函数形如 Component( (xxx) => {xxx} )  则 返回参数中的函数体  (xxx) => {xxx} 


```javascript
// 生成 FN 节点
export function extractFnFromMacro(
  path: NodePath<t.CallExpression>,
  macroName: string
): NodePath<t.FunctionExpression> | NodePath<t.ArrowFunctionExpression> {
  // Component(()=>{}) 或 Component(function xxx(){...})   获取其中的参数部分
  const args = path.get('arguments');
  const fnNode = args[0];

  // 如果Component() 是函数声明则返回，不是函数声明，则报错
  if (fnNode.isFunctionExpression() || fnNode.isArrowFunctionExpression()) {
    return fnNode;
  }
  throw new CompilerError(`${macroName} macro must have a function argument`, path.node.loc);
}
```


## 1.3 判断函数组件的类型 函数 Component( () => {...} )  or  勾子 Hook(() => {})


`packages\transpiler\babel-inula-next-core\src\utils.ts   工具类`

```javascript
// 判断函数组件类型 组件/勾子
export function getMacroType(path: NodePath<t.CallExpression>) {
  // 形如 Component(() => {})
  if (isCompPath(path as NodePath<t.CallExpression>)) {
    return COMPONENT;
  }

  // 形如Hook(() => {})
  if (isHookPath(path as NodePath<t.CallExpression>)) {
    return HOOK;
  }

  return null;
}

```








# 2. 类组件持 IR 生成


##  2.1  类组件生成 IR 入口



```javascript


  // 类组件 生成 IR
function transformNodeForCls(
  path: NodePath<t.ClassDeclaration>,
  htmlTags: string[],
  state: PluginState,
  hoist: (node: t.Statement | t.Statement[]) => void
) {
  //  todo... 
  return false;
}


```



## 2.2 返回类组件节点

`packages\transpiler\babel-inula-next-core\src\utils.ts   工具类`


```javascript
// 生成 Class 节点
export function clsNode(
  path: NodePath<t.ClassDeclaration>,
  // path: NodePath<t.CallExpression>
): NodePath<t.ClassDeclaration> {
  const componentType = getClsType(path);
  if (componentType === CLS_COMPONENT) {
    return path;
  }
  throw new CompilerError(`${path.node.id?.name}  must be a class argument`, path.node.loc);
}
```



## 2.3 判断 path 为类组件

`packages\transpiler\babel-inula-next-core\src\utils.ts   工具类`

类组件的形式应为  class Comp extends Component  { ... }  ：

```javascript

// 当前类组件只有一种类型
export function getClsType(path: NodePath<t.ClassDeclaration>){
  // class xxx extend Component {}
  if(isClsPath(path)){
    return CLS_COMPONENT;
  }
  return null;
}

export function isClsPath(path: NodePath<t.ClassDeclaration>) {
  // find the class, like: class xxx extend Component {}
  return path.node.type === 'ClassDeclaration' &&
    path.node.superClass !== null &&
    path.node.superClass !== undefined &&
    (
      (path.node.superClass.type === 'Identifier' && path.node.superClass.name === 'Component') ||
      (path.node.superClass.type === 'StringLiteral' && path.node.superClass.value === 'Component')
    );
}

```



















 










