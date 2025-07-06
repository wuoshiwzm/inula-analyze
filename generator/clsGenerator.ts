import { Generator } from './index';
import { getBabelApi, types as t } from '@openinula/babel-api';
import { wrapUpdate } from './utils';

export function clsGenerator(): Generator {

    return {
        /**
         * self.watch(() => {
         *  console.log(count);
         * }, () => [count], 0b1);
         * @param stmt
         * @returns
         */


        // 2 处理 watch 语法（如状态监听）

        /**
         *  
         * @param stmt 当前语句的 AST 节点信息，包含：
         *             callback.node: 监听回调函数的 AST 节点。
         *             dependency: 依赖项（如 () => [count]）。
         * @param param1 上下文参数
         *             selfId: 当前组件的引用标识（如 this 的替代）。
         *             getWaveBits: 获取“波动位”的函数（用于优化更新）。
         *             getReactBits: 获取“响应位”的函数（标记依赖变更）。
         * @returns 
         */
        watch(stmt, { selfId, getWaveBits, getReactBits }) {

            // 2.1 包装回调函数: 调用 wrapUpdate 修改回调函数体，注入更新逻辑
            const watchFnBody = stmt.callback.node;
            wrapUpdate(selfId, watchFnBody, getWaveBits);
            
            
            // 2.2 生成新的 AST 节点: 
            //  生成等效于以下代码的 AST：
            //  self.watch(
            //     () => { /* 包装后的回调 */ },
            //     () => [count],  // 依赖项数组
            //     0b1            // 响应位（二进制掩码）
            //     );

            return t.expressionStatement(
                t.callExpression(t.memberExpression(selfId, t.identifier('watch')), [
                watchFnBody,
                stmt.dependency ? t.arrowFunctionExpression([], stmt.dependency.dependenciesNode) : t.nullLiteral(),
                t.numericLiteral(getReactBits(stmt.dependency?.depIdBitmap ?? 0)),
                ])
            );
        },
        
        
        // 3 lifecycle 方法
        /**
         * 
         * @param stmt callback.node: 生命周期回调的 AST 节点。
         *             lifeCycle: 生命周期名称（如 onMount）。
         * @param param1 
         * @returns 
         */
        lifecycle(stmt, { selfId, getWaveBits }) {

            // 3.1 包装回调函数 类似 watch，对回调函数进行包装。
            const fnBody = stmt.callback.node;
            wrapUpdate(selfId, fnBody, getWaveBits);
            
            // 3.2 生成新的 AST 节点: 生成等效于以下代码的 AST：
            //         self.onMount(() => { /* 包装后的回调 */ });
            return t.expressionStatement(
                t.callExpression(t.memberExpression(selfId, t.identifier(stmt.lifeCycle)), [fnBody])
            );
            },
        };
    
    }




}
