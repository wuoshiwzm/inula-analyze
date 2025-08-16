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




/**
 * 类组件的 IRBuilder
 * 
 * 
 * 
 */
import {
  BaseVariable,
  ClassNode,
  ClsNode,
  ClsType,
  ComponentNode,
  DerivedSource,
  DerivedStmt,
  HookNode,
  IRBlock,
  IRStmt,
  LifeCycle,
  PARAM_PROPS,
  PropsSource,
  RestPropStmt,
  SinglePropStmt,
  StateStmt,
  WholePropStmt,
} from './types';
import { createClsIRNode, createIRNode } from './nodeFactory';
import type { NodePath } from '@babel/core';
import { getBabelApi, types as t } from '@openinula/babel-api';
import { CLS_COMPONENT, COMPONENT, isPropStmt, PropType, reactivityFuncNames } from '../constants';
import { Dependency, getDependenciesFromNode, parseReactivity } from '@openinula/reactivity-parser';
import { assertComponentNode, assertHookNode, isUseHook } from './utils';
import { parseView as parseJSX } from '@openinula/jsx-view-parser';
import { pruneUnusedState } from './pruneUnusedState';
import { assertIdOrDeconstruct, bitmapToIndices } from '../utils';
import { CompilerError } from '@openinula/error-handler';
import { ClassDeclaration } from 'babel-types';
import { ClassExpression } from '@babel/types';

function trackSource(waveBitsMap: Map<number, number>, stmt: DerivedStmt, ownBit: number) {
  // Then, we need to find the wave bits(other derived reactive dependency on it) of the derived reactive id
  const downstreamWaveBits = waveBitsMap.get(stmt.reactiveId);

  const derivedWaves = downstreamWaveBits ? downstreamWaveBits | ownBit : ownBit;

  // At last, add the derived wave bit to the source
  if (stmt.dependency) {
    bitmapToIndices(stmt.dependency.depIdBitmap).forEach(id => {
      const waveBits = waveBitsMap.get(id);
      if (waveBits) {
        waveBitsMap.set(id, waveBits | derivedWaves);
      } else {
        waveBitsMap.set(id, derivedWaves);
      }
    });
  }
}

function getWaveBits(
  idToWaveBitMap: Map<number, number>,
  stmt: StateStmt | DerivedStmt | SinglePropStmt | RestPropStmt | WholePropStmt,
  waveBitsMap: Map<number, number>
) {
  const ownBit = idToWaveBitMap.get(stmt.reactiveId);
  let waveBits = ownBit;
  if (ownBit) {
    // if ownBit exist, means the state was used. Try to find derivedState using the state
    const downstreamWaveBits = waveBitsMap.get(stmt.reactiveId) ?? 0;
    waveBits = ownBit | downstreamWaveBits;
  }
  return waveBits;
}




export interface ClsIRBuilderOptions {
  name: string;
  clsNode: NodePath<ClassExpression>;
  parent?: ClassNode;
}


export class ClsIRBuilder {
  #current: ClassNode;
  readonly #htmlTags: string[];
  reactiveIndex = 0;


  // 构造函数 createClsIRNode
  constructor(options: ClsIRBuilderOptions, htmlTags: string[]) {
    const { name, clsNode, parent } = options;
    this.#current = createClsIRNode(name, CLS_COMPONENT, clsNode, parent) as ClassNode;
    this.#htmlTags = htmlTags;
  }

  private parseIdInLVal(id: NodePath<t.LVal>, reactiveId?: number) {
    let varIds: string[] = [];
    if (id.isIdentifier()) {
      const name = id.node.name;
      this.addDeclaredReactive(name, reactiveId);
      varIds.push(name);
    } else if (id.isObjectPattern() || id.isArrayPattern()) {
      const destructuredNames = searchNestedProps(id);
      destructuredNames.forEach(name => {
        this.addDeclaredReactive(name, reactiveId);
      });
      varIds = destructuredNames;
    }
    return varIds;
  }

  private addUsedReactives(usedIdBits: number) {
    this.#current.scope.usedIdBits |= usedIdBits;
  }

  getNextId() {
    return 1 << this.reactiveIndex++;
  }

  addStmt(stmt: IRStmt) {
    this.#current.body.push(stmt);
  }

  addDeclaredReactive(name: string, id?: number) {
    const reactiveId = id ?? this.getNextId();
    this.#current.scope.reactiveMap.set(name, reactiveId);
    return reactiveId;
  }

  /**
 * Get tree level global reactive map
 */
  getGlobalReactiveMap() {
    const fullReactiveMap = new Map(this.#current.scope.reactiveMap);
    let next = this.#current.parent;
    while (next) {
      next.scope.reactiveMap.forEach((id, name) => {
        if (!fullReactiveMap.has(name)) {
          fullReactiveMap.set(name, id);
        }
      });
      next = next.parent;
    }

    return fullReactiveMap;
  }

  getDependency = (node: t.Expression | t.Statement) => {
    return getDependenciesFromNode(node, this.getGlobalReactiveMap(), reactivityFuncNames);
  };

  addRawStmt(stmt: t.Statement) {
    this.addStmt({
      type: 'raw',
      value: stmt,
    });
  }

  addProps(name: string, value: t.Identifier, source: PropsSource = PARAM_PROPS, ctxName?: string) {
    const reactiveId = this.addDeclaredReactive(name);
    this.addStmt({
      name,
      value,
      type: PropType.WHOLE,
      reactiveId,
      source,
      ctxName,
    });
  }

  addRestProps(name: string, source: PropsSource = PARAM_PROPS, ctxName?: string) {
    const reactiveId = this.addDeclaredReactive(name);
    this.addStmt({
      name,
      type: PropType.REST,
      reactiveId,
      source,
      ctxName,
    });
  }

  /**
 * 添加一个单个属性到对象中。
 * 这个函数用于处理 JavaScript/TypeScript 的对象字面量，可能是编译器或代码转换工具的一部分。
 * 它接收一个键（key）、一个值路径（valPath）、一个属性源（source）和一个上下文名称（ctxName）作为参数。
 * 它会检查值路径是否是一个有效的左值（LVal），如果不是，会抛出一个编译器错误。
 * 然后，它会获取下一个 ID，并根据值路径是否被解构来处理不同的逻辑。
 * 最后，它会添加一个语句，包含键、反应式 ID、值、类型、是否被解构、默认值、源和上下文名称。
 * @param key - 属性的键
 * @param valPath - 属性的值路径
 * @param source - 属性的来源，默认为 PARAM_PROPS
 * @param ctxName - 上下文名称
 * @throws {CompilerError} 如果值路径不是有效的左值
 */
  addSingleProp(
    key: string | number,
    valPath: NodePath<t.Expression | t.PatternLike>,
    source: PropsSource = PARAM_PROPS,
    ctxName?: string
  ) {
    // 检查值路径是否是有效的左值（LVal），如果不是，抛出编译器错误
    if (!valPath.isLVal()) {
      throw new CompilerError('Invalid Prop Value type: ' + valPath.type, valPath.node.loc);
    }

    // 获取下一个唯一的 ID
    const reactiveId = this.getNextId();

    // 检查值路径是否被解构
    const destructured = getDestructure(valPath);
    let value = valPath.node;
    let defaultValue: t.Expression | null = null;

    if (destructured) {
      // 如果值路径被解构，获取所有解构的名称
      const destructuredNames = searchNestedProps(destructured);

      // 为每个解构的名称添加声明的反应式
      destructuredNames.forEach(name => this.addDeclaredReactive(name, reactiveId));
    } else {
      // 如果没有被解构，获取属性名
      let propName = key;

      // 如果值路径是标识符且名称与键不同，使用标识符的名称作为属性名
      if (valPath.isIdentifier() && valPath.node.name !== key) {
        propName = valPath.node.name;
      }

      // 如果值路径是赋值模式（如 { a = defaultValue }），处理赋值逻辑
      if (valPath.isAssignmentPattern()) {
        const left = valPath.node.left;
        if (t.isIdentifier(left) && left.name !== key) {
          propName = left.name;
        }
        value = left;
        defaultValue = valPath.node.right;
      }

      // 为属性名添加声明的反应式
      this.addDeclaredReactive(propName as string, reactiveId);
    }

    // 添加一个语句，包含键、反应式 ID、值、类型、是否被解构、默认值、源和上下文名称
    this.addStmt({
      name: key,
      reactiveId,
      value,
      type: PropType.SINGLE,
      isDestructured: !!destructured,
      defaultValue,
      source,
      ctxName,
    });
  }

  /*
    private parseIdInLVal(id: NodePath<t.LVal>, reactiveId?: number) {
    let varIds: string[] = [];
    if (id.isIdentifier()) {
      const name = id.node.name;
      this.addDeclaredReactive(name, reactiveId);
      varIds.push(name);
    } else if (id.isObjectPattern() || id.isArrayPattern()) {
      const destructuredNames = searchNestedProps(id);
      destructuredNames.forEach(name => {
        this.addDeclaredReactive(name, reactiveId);
      });
      varIds = destructuredNames;
    }
    return varIds;
  }
  */

// ******************添加变量，类组件和函数组件不一样，函数组件中的生成变量就是 setState, 类组件可不是
addVariable(varInfo: BaseVariable<t.Expression | null>) {
  // 获取变量的id和值
  const id = varInfo.id;
  const value = varInfo.value;

  // 生成一个唯一的变量的reactiveId
  const reactiveId = this.getNextId();

  // 解析变量id，获取其在左值表达式中的id
  const varIds = this.parseIdInLVal(id, reactiveId);

  // 如果变量的值存在
  if (value) {
    // 获取变量值的依赖关系
    const dependency = this.getDependency(value);

    // 如果值是一个hook函数调用
    if (isUseHook(value)) {
      // 如果存在依赖关系，将其添加到已使用的reactive中
      if (dependency) {
        this.addUsedReactives(dependency.depIdBitmap);
      }

      // 添加一个类型为'derived'的语句，表示该变量是派生的 包含变量的id、reactiveId、值、依赖关系等信息
      // 类 A_class.a -> 类 B_class.A_object.a   A_object 为 A_class 的对象
      this.addStmt({
        type: 'derived',
        ids: varIds,
        lVal: id.node,
        reactiveId: reactiveId,
        value,
        source: DerivedSource.HOOK,
        dependency,
        hookArgDependencies: getHookProps(value, this.getDependency),
      });
      return;
    }

    // 如果值不是hook函数调用，但存在依赖关系
    if (dependency) {
      // 将依赖关系添加到已使用的reactive中
      this.addUsedReactives(dependency.depIdBitmap);

      // 添加一个类型为'derived'的语句，表示该变量是派生的
      // 包含变量的id、reactiveId、值、依赖关系等信息
      this.addStmt({
        type: 'derived',
        ids: varIds,
        lVal: id.node,
        reactiveId: reactiveId,
        value,
        source: DerivedSource.STATE,
        dependency,
      });
      return;
    }
  }

  // 这里要改， 函数中的变量生成就是 setState, 但是类组件中可不是

  // 如果值不存在依赖关系，或者值为null/undefined
  // 添加一个类型为'state'的语句，表示该变量是一个原始状态
  this.addStmt({
    type: 'state',
    name: id.node,
    value,
    reactiveId,
    node: varInfo.node,
  });
}


}



















/**
 * 生成 IR 
 */
export class ClsIRBuilder1 {
  #current: ClsNode; // 类组件节点
  readonly #htmlTags: string[];  // 对应 html 代码
  reactiveIndex = 0;

  // 构造函数
  constructor(name: string, type: ClsType, clsNode: NodePath<ClassExpression>, htmlTags: string[]) {
    this.#current = createClsIRNode(name, type, clsNode);
    this.#htmlTags = htmlTags;
  }

  getNextId() {
    return 1 << this.reactiveIndex++;
  }

  addStmt(stmt: IRStmt) {
    this.#current.body.push(stmt);
  }

  addDeclaredReactive(name: string, id?: number) {
    const reactiveId = id ?? this.getNextId();
    this.#current.scope.reactiveMap.set(name, reactiveId);
    return reactiveId;
  }

  /**
   * Get tree level global reactive map
   */
  getGlobalReactiveMap() {
    const fullReactiveMap = new Map(this.#current.scope.reactiveMap);
    let next = this.#current.parent;
    while (next) {
      next.scope.reactiveMap.forEach((id, name) => {
        if (!fullReactiveMap.has(name)) {
          fullReactiveMap.set(name, id);
        }
      });
      next = next.parent;
    }

    return fullReactiveMap;
  }

  getDependency = (node: t.Expression | t.Statement) => {
    return getDependenciesFromNode(node, this.getGlobalReactiveMap(), reactivityFuncNames);
  };

  addRawStmt(stmt: t.Statement) {
    this.addStmt({
      type: 'raw',
      value: stmt,
    });
  }

  addProps(name: string, value: t.Identifier, source: PropsSource = PARAM_PROPS, ctxName?: string) {
    const reactiveId = this.addDeclaredReactive(name);
    this.addStmt({
      name,
      value,
      type: PropType.WHOLE,
      reactiveId,
      source,
      ctxName,
    });
  }

  addRestProps(name: string, source: PropsSource = PARAM_PROPS, ctxName?: string) {
    // check if the props is initialized
    const reactiveId = this.addDeclaredReactive(name);
    this.addStmt({
      name,
      type: PropType.REST,
      reactiveId,
      source,
      ctxName,
    });
  }

  addSingleProp(
    key: string | number,
    valPath: NodePath<t.Expression | t.PatternLike>,
    source: PropsSource = PARAM_PROPS,
    ctxName?: string
  ) {
    if (!valPath.isLVal()) {
      throw new CompilerError('Invalid Prop Value type: ' + valPath.type, valPath.node.loc);
    }
    const reactiveId = this.getNextId();
    const destructured = getDestructure(valPath);
    let value = valPath.node;
    let defaultValue: t.Expression | null = null;
    if (destructured) {
      const destructuredNames = searchNestedProps(destructured);

      // All destructured names share the same id
      destructuredNames.forEach(name => this.addDeclaredReactive(name, reactiveId));
    } else {
      let propName = key;
      // alias
      if (valPath.isIdentifier() && valPath.node.name !== key) {
        propName = valPath.node.name;
      }
      if (valPath.isAssignmentPattern()) {
        const left = valPath.node.left;
        if (t.isIdentifier(left) && left.name !== key) {
          propName = left.name;
        }
        value = left;
        defaultValue = valPath.node.right;
      }
      this.addDeclaredReactive(propName as string, reactiveId);
    }
    this.addStmt({
      name: key,
      reactiveId,
      value,
      type: PropType.SINGLE,
      isDestructured: !!destructured,
      defaultValue,
      source,
      ctxName,
    });
  }

  addVariable(varInfo: BaseVariable<t.Expression | null>) {
    const id = varInfo.id;
    const reactiveId = this.getNextId();
    const varIds = this.parseIdInLVal(id, reactiveId);
    const value = varInfo.value;
    if (value) {
      const dependency = this.getDependency(value);

      if (isUseHook(value)) {
        if (dependency) {
          this.addUsedReactives(dependency.depIdBitmap);
        }
        this.addStmt({
          type: 'derived',
          ids: varIds,
          lVal: id.node,
          reactiveId: reactiveId,
          value,
          source: DerivedSource.HOOK,
          dependency,
          hookArgDependencies: getHookProps(value, this.getDependency),
        });
        return;
      }

      if (dependency) {
        this.addUsedReactives(dependency.depIdBitmap);
        this.addStmt({
          type: 'derived',
          ids: varIds,
          lVal: id.node,
          reactiveId: reactiveId,
          value,
          source: DerivedSource.STATE,
          dependency,
        });

        return;
      }
    }

    this.addStmt({
      type: 'state',
      name: id.node,
      value,
      reactiveId,
      node: varInfo.node,
    });
  }

  private parseIdInLVal(id: NodePath<t.LVal>, reactiveId?: number) {
    let varIds: string[] = [];
    if (id.isIdentifier()) {
      const name = id.node.name;
      this.addDeclaredReactive(name, reactiveId);
      varIds.push(name);
    } else if (id.isObjectPattern() || id.isArrayPattern()) {
      const destructuredNames = searchNestedProps(id);
      destructuredNames.forEach(name => {
        this.addDeclaredReactive(name, reactiveId);
      });
      varIds = destructuredNames;
    }
    return varIds;
  }

  addContext(id: NodePath<t.LVal>, context: t.Identifier) {
    assertIdOrDeconstruct(id, 'Invalid Variable type when using context: ' + id.type);

    this.addStmt({
      type: 'useContext',
      lVal: id.node,
      context,
    });
  }

  private addUsedReactives(usedIdBits: number) {
    this.#current.scope.usedIdBits |= usedIdBits;
  }

  addSubComponent(subComp: ComponentNode) {
    this.#current.scope.usedIdBits |= subComp.scope.usedIdBits;
    this.addStmt({
      type: 'subComp',
      component: subComp,
      name: subComp.name,
    });
  }

  addLifecycle(lifeCycle: LifeCycle, callback: NodePath<t.ArrowFunctionExpression> | NodePath<t.FunctionExpression>) {
    this.addStmt({
      type: 'lifecycle',
      lifeCycle,
      callback,
    });
  }

  addWatch(
    callback: NodePath<t.ArrowFunctionExpression> | NodePath<t.FunctionExpression>,
    dependency: Dependency | null
  ) {
    if (dependency) {
      this.addUsedReactives(dependency.depIdBitmap);
    }
    this.addStmt({
      type: 'watch',
      callback,
      dependency,
    });
  }

  setViewChild(viewNode: t.JSXElement | t.JSXFragment) {
    assertComponentNode(this.#current);

    const viewUnits = parseJSX(viewNode, {
      babelApi: getBabelApi(),
      htmlTags: this.#htmlTags,
      parseTemplate: false,
    });

    const [viewParticle, useIdBits] = parseReactivity(viewUnits, {
      babelApi: getBabelApi(),
      reactiveMap: this.getGlobalReactiveMap(),
      reactivityFuncNames,
    });

    this.addStmt({
      type: 'viewReturn',
      value: viewParticle,
    });
    this.addUsedReactives(useIdBits);
  }

  setReturnValue(expression: t.Expression) {
    assertHookNode(this.#current);
    const dependency = this.getDependency(expression);

    if (dependency) {
      this.addUsedReactives(dependency.depIdBitmap);
    }
    this.addStmt({
      type: 'hookReturn',
      value: expression,
      ...dependency,
    });
  }

  checkSubComponent(subCompName: string) {
    return !!this.#current.body.find(sub => sub.type === 'subComp' && sub.name === subCompName);
  }

  startSubComponent(name: string, fnNode: NodePath<t.ArrowFunctionExpression> | NodePath<t.FunctionExpression>) {
    assertComponentNode(this.#current);
    this.#current = createIRNode(name, COMPONENT, fnNode, this.#current);
  }

  endSubComponent() {
    const subComp = this.#current as ComponentNode; // we start from a component node
    this.#current = this.#current.parent!;
    this.addSubComponent(subComp);
  }

  // 生成 类组件
  addCls(path: NodePath<t.ExpressionStatement>) {

  }

  build() {
    const idToWaveBitMap = new Map<number, number>();
    pruneUnusedState(this.#current, idToWaveBitMap);
    // wave map is a map from reactive id to wave bit
    const waveBitsMap = new Map<number, number>();

    function buildWaveMap(block: IRBlock) {
      for (let i = block.body.length - 1; i >= 0; i--) {
        const stmt = block.body[i];
        if (stmt.type === 'state' || stmt.type === 'derived' || isPropStmt(stmt)) {
          const waveBits = getWaveBits(idToWaveBitMap, stmt, waveBitsMap);
          if (waveBits) {
            waveBitsMap.set(stmt.reactiveId, waveBits);
            if (stmt.type === 'derived') {
              trackSource(waveBitsMap, stmt, waveBits);
            }
          }
        }
      }
    }

    // post order traverse to build wave map because
    // e.g. a = b, b = c, a need to know c's wave bit,
    // so we need to traverse bottom up
    function traverse(node: ComponentNode | HookNode) {
      node.body.forEach(stmt => {
        if (stmt.type === 'subComp') {
          traverse(stmt.component);
        }
      });
      buildWaveMap(node);
    }

    traverse(this.#current);
    return [this.#current, new BitManager(waveBitsMap, idToWaveBitMap)] as const;
  }
}

export class BitManager {
  constructor(
    private readonly waveBitsMap: Map<number, number>,
    private readonly idToWaveBitMap: Map<number, number>
  ) { }

  getWaveBits = (block: IRBlock, name: string) => {
    let current: IRBlock | undefined = block;
    while (current) {
      const id = current.scope.reactiveMap.get(name);
      if (id) {
        return this.waveBitsMap.get(id) ?? 0;
      }
      current = current.parent;
    }
    return 0;
  };

  getWaveBitsById = (id: number) => {
    return this.waveBitsMap.get(id) ?? 0;
  };

  getReactBits = (idBitmap: number) => {
    return bitmapToIndices(idBitmap).reduce((acc, depId) => {
      const waveBit = this.idToWaveBitMap.get(depId);
      if (waveBit) {
        return acc | waveBit;
      }
      throw new Error(`wave bit not found for id ${depId}`);
    }, 0);
  };
}

/**
 * Iterate identifier in nested destructuring, collect the identifier that can be used
 * e.g. function ({prop1, prop2: [p20X, {p211, p212: p212X}]}
 * we should collect prop1, p20X, p211, p212X
 * @param idPath
 */
export function searchNestedProps(idPath: NodePath<t.ArrayPattern | t.ObjectPattern>) {
  const nestedProps: string[] | null = [];

  if (idPath.isObjectPattern() || idPath.isArrayPattern()) {
    idPath.traverse({
      Identifier(path) {
        // judge if the identifier is a prop
        // 1. is the key of the object property and doesn't have alias
        // 2. is the item of the array pattern and doesn't have alias
        // 3. is alias of the object property
        const parentPath = path.parentPath;
        if (parentPath.isObjectProperty() && path.parentKey === 'value') {
          // collect alias of the object property
          nestedProps.push(path.node.name);
        } else if (
          parentPath.isArrayPattern() ||
          parentPath.isObjectPattern() ||
          parentPath.isRestElement() ||
          (parentPath.isAssignmentPattern() && path.key === 'left')
        ) {
          // collect the key of the object property or the item of the array pattern
          nestedProps.push(path.node.name);
        }
      },
    });
  }

  return nestedProps;
}

function getDestructure(path: NodePath<t.LVal>) {
  if (path.isAssignmentPattern()) {
    const left = path.get('left');
    if (left.isObjectPattern() || left.isArrayPattern()) {
      return left;
    }
  } else if (path.isObjectPattern() || path.isArrayPattern()) {
    return path;
  }
  return null;
}

function getHookProps(value: t.CallExpression, getDependency: (node: t.Expression | t.Statement) => Dependency | null) {
  const params = value.arguments;

  return params.map(param => {
    if (t.isSpreadElement(param)) {
      return getDependency(param.argument);
    }
    if (t.isArgumentPlaceholder(param)) {
      return null;
    }
    return getDependency(param);
  });
}
