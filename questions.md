## 1. props



### 1.1 props 来源 param 和 ctx 指的是什么？ CTX 上下文？ 指什么？

```typescript
// props 来源： 参数 / 上下文
export const PARAM_PROPS = 'props';
export const CTX_PROPS = 'ctx';
export type PropsSource = typeof PARAM_PROPS | typeof CTX_PROPS;

```



### 1.2 single props , rest props 分别指什么