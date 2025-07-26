## 1. props



### 1.1 props 来源 param 和 ctx 指的是什么？ CTX 上下文？ 指什么？

```typescript
// props 来源： 参数 / 上下文
export const PARAM_PROPS = 'props';
export const CTX_PROPS = 'ctx';
export type PropsSource = typeof PARAM_PROPS | typeof CTX_PROPS;

```



### 1.2 props 语句 (PropStmt) 的三个类型 single props , rest props, whole prop 分别指什么？  
### restProp 类型没有 value 属性 ？


```typescript
export enum PropType {
  REST = 'restProp',
  SINGLE = 'singleProp',
  WHOLE = 'wholeProp',
}
```

### 1.3 single prop 语句的属性 name 和  ctxName
```typescript
// single props: 
export interface SinglePropStmt {
  name: string | number;                  // prop 名字： 字符串或数字？
  value: t.LVal;                          // 左值
  reactiveId: number;                     // 相应 ID
  type: PropType.SINGLE;                  // prop 类型
  isDestructured: boolean;                // 是否已经销毁
  defaultValue?: t.Expression | null;     // 默认值
  source: PropsSource;                    // 来源
  ctxName?: string;                       // 上下文名?
}

```

### 1.4 