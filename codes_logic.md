


判断为 函数组件/类组件/勾子函数

`packages\transpiler\babel-inula-next-core\src\utils.ts`

```
export function getMacroType(path: NodePath<t.CallExpression>) {
    if (isCompPath(path)) {
    return COMPONENT;
    }
    if (isHookPath(path)) {
    return HOOK;
    }
    return null;
}
```

改为：


```

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

export function isClsPath(path: NodePath<t.ClassDeclaration>){
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




# 生成 IR


```
babel-inula-next-core\src\plugin.ts
```



```
 // 类组件 生成 IR 
function transformNodeForCls(
  path: NodePath<t.ClassDeclaration>,
  htmlTags: string[],
  state: PluginState,
  hoist: (node: t.Statement | t.Statement[]) => void
) {
  if (ALREADY_COMPILED.has(path)) return false;

  // 类组件获取类型
  const type = getMacroType(path);

  if (type) {

    let componentNode;
    if(type === COMPONENT){
      componentNode = extractFnFromMacro(path, type);
    }
    let name = '';
    // try to get the component name, when parent is a variable declarator
    if (path.parentPath.isVariableDeclarator()) {
      const lVal = path.parentPath.get('id');
      if (lVal.isIdentifier()) {
        name = lVal.node.name;
      } else {
        console.error(`${type} macro must be assigned to a variable`);
      }
    }
    // 生成 IR  root
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
