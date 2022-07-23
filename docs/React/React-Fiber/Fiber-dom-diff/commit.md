上一章[最后一节](../process/completeWork.html#流程结尾)我们介绍了，`commitRoot`方法是`commit阶段`工作的起点。`fiberRootNode`会作为传参。

```js
commitRoot(root);
```

在`rootFiber.firstEffect`上保存了一条需要执行`副作用`的`Fiber节点`的单向链表`effectList`，这些`Fiber节点`的`updateQueue`中保存了变化的`props`。

这些`副作用`对应的`DOM操作`在`commit`阶段执行。

除此之外，一些生命周期钩子（比如`componentDidXXX`）、`hook`（比如`useEffect`）需要在`commit`阶段执行。

`commit`阶段的主要工作（即`Renderer`的工作流程）分为三部分：

- before mutation 阶段（执行`DOM`操作前）

- mutation 阶段（执行`DOM`操作）

- layout 阶段（执行`DOM`操作后）

你可以从[这里](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L2001)看到`commit`阶段的完整代码

在`before mutation阶段`之前和`layout阶段`之后还有一些额外工作，涉及到比如`useEffect`的触发、`优先级相关`的重置、`ref`的绑定/解绑。

这些对我们当前属于超纲内容，为了内容完整性，在这节简单介绍。

```js
//提交，修改DOM
function commitRoot() {
  //指向新构建的fiber树
  const finishedWork = workInProgressRoot.current.alternate;
  workInProgressRoot.finishedWork = finishedWork;
  commitMutationEffects(workInProgressRoot);
}
```

在`commitMutationEffects`方法里面，会去循环这个`effectList`链表，会根据每一个 effect 的 tag 去判断当前节点的具体操作，比如需要删除，新增，修改属性等。。。

```js
function commitMutationEffects(root) {
  const finishedWork = root.finishedWork;
  let nextEffect = finishedWork.firstEffect;
  let effectsList = "";
  while (nextEffect) {
    const flags = nextEffect.flags;
    let current = nextEffect.alternate;
    //如果是插入
    if (flags === Placement) {
      commitPlacement(nextEffect);
      //如果是插入 和更新
    } else if (flags === PlacementAndUpdate) {
      commitPlacement(nextEffect);
      nextEffect.flags = Update;
      commitWork(current, nextEffect);
      //如果是更新
    } else if (flags === Update) {
      commitWork(current, nextEffect);
      //如果是删除
    } else if (flags === Deletion) {
      commitDeletion(nextEffect);
    }
    //指向下一个effect
    nextEffect = nextEffect.nextEffect;
  }
  root.current = finishedWork;
}
```
