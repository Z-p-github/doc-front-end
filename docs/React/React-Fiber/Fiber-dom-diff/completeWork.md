## completeUnitOfWork

上一节我们讲解了组件执行`beginWork`后会创建`子Fiber节点`，节点上可能存在`effectTag`。

这一节让我们看看`completeWork`会做什么工作。

```js
/**
 * 完成一个fiber节点
 * @param {*} unitOfWork
 */
function completeUnitOfWork(unitOfWork) {
  let completedWork = unitOfWork;
  do {
    const current = completedWork.alternate;
    const returnFiber = completedWork.return;
    //完成此fiber对应的真实DOM节点创建和属性赋值的功能
    completeWork(current, completedWork);
    //收集当前fiber的副作用到父fiber上
    collectEffectList(returnFiber, completedWork);
    //当自己这个fiber完成后，如何寻找下一个要构建的fiber
    const siblingFiber = completedWork.sibling;
    if (siblingFiber) {
      //如果有弟弟，就开始构建弟弟，处理弟弟 completeUnitOfWork
      workInProgress = siblingFiber;
      return;
    }
    //如果没有弟弟，说明这是最后一个儿子了，父亲也可以完成了
    //这个循环到最后的时候 returnFiber就是null,也就是根fiber的父亲
    completedWork = returnFiber;
    //不停的修改当前正在处理的fiber最后 workInProgress=null就可以退出workLoop了
    workInProgress = completedWork;
  } while (workInProgress);
}
```

## 主要作用

beginWork 阶段若不需要再向下遍历，Fiber 节点会开始回溯，判断是否存在兄弟节点需要进行遍历，如果没有，则回溯到父节点，并将自身及自身子树上的 effect 形成 effect list 向父节点传递，以此往复，直至 HostRoot，这个过程被称为 completeUnitOfWork。

合在一起，就是 render 过程，它是纯粹的 JS 计算，不（应）带有任何“副作用”。

## 开始

在`completeUnitOfWork`方法里面，会循环的去执行主要的两个方法 `completeWork(完成此fiber对应的真实DOM节点创建和属性赋值的功能)`,`collectEffectList(收集当前fiber的副作用到父fiber上)`

在`completeUnitOfWork`每次循环完之后，会去做两条事情，第一个就是会去根据子 fiber 生成真实的 dom 节点，并且会给 dom 节点绑定对应的属性，第二件事情就是会去收集每一个节点的 `effectTag`，并最终会回溯到父节点上面去，生成一条 `effectList` 链表，之后呢，会去找当前子节点是否有兄弟节点，然后接着去处理兄弟节点，如果没有兄弟节点上，说明这个循环就到最后了，这个时候就要去处理父 fiber 了

```js
//当自己这个fiber完成后，如何寻找下一个要构建的fiber
const siblingFiber = completedWork.sibling;
if (siblingFiber) {
  //如果有弟弟，就开始构建弟弟，处理弟弟 completeUnitOfWork
  workInProgress = siblingFiber;
  return;
}
```

在 `completeWork` 里面，会根据具体的一个 fiber 类型去调用不同的处理逻辑。这里我们重点关注页面渲染所必须的`HostComponent`（即原生`DOM组件`对应的`Fiber节点`）

```js
export function completeWork(current, workInProgress) {
  const newProps = workInProgress.pendingProps;
  switch (workInProgress.tag) {
    case HostComponent:
      //在新的fiber构建完成的时候，收集更新并且标识 更新副作用
      if (current && workInProgress.stateNode) {
        updateHostComponent(
          current,
          workInProgress,
          workInProgress.tag,
          newProps
        );
      } else {
        //创建真实的DOM节点
        const type = workInProgress.type; //div p span
        //创建此fiber的真实DOM
        const instance = createInstance(type, newProps);
        appendAllChildren(instance, workInProgress);
        //让此Fiber的真实DOM属性指向instance
        workInProgress.stateNode = instance;
        //给真实DOM添加属性 包括如果独生子是字符串或数字的情况
        finalizeInitialChildren(instance, type, newProps);
      }
      break;
    default:
      break;
  }
}
```

### 如果老的节点可以复用

第一个判断，如果可以复用，并且 `stateNode` 存在，那么就会去更新新的 fiber 节点(`workInProgress`)的 `updateQueue` 属性，里面保存更新的 prop(比如属性值改变等。。。)，根据新老节点的 prop 去做比较进行更新

### 如果老的节点不能复用

否责会去做两件事：

第一件就是会去生成该对应 fiber 的真实 dom 节点，并且赋值给 fiber 节点的 stateNode 属性。因为在 beginwork 阶段的时候只是生成了一个 fiber 节点没有生成 dom 节点

第二节事情就是会把相应的属性放置到原生 dom 上面去，即 pendingProps 上面的属性

## collectEffectList 副作用链收集

```js
function collectEffectList(returnFiber, completedWork) {
  if (returnFiber) {
    //如果父亲 没有effectList,那就让父亲 的firstEffect链表头指向自己的头
    if (!returnFiber.firstEffect) {
      returnFiber.firstEffect = completedWork.firstEffect;
    }
    //如果自己有链表尾
    if (completedWork.lastEffect) {
      //并且父亲也有链表尾
      if (returnFiber.lastEffect) {
        //把自己身上的effectlist挂接到父亲的链表尾部
        returnFiber.lastEffect.nextEffect = completedWork.firstEffect;
      }
      returnFiber.lastEffect = completedWork.lastEffect;
    }
    const flags = completedWork.flags;
    //如果此完成的fiber有副使用，那么就需要添加到effectList里
    if (flags) {
      //如果父fiber有lastEffect的话，说明父fiber已经有effect链表
      if (returnFiber.lastEffect) {
        returnFiber.lastEffect.nextEffect = completedWork;
      } else {
        returnFiber.firstEffect = completedWork;
      }

      returnFiber.lastEffect = completedWork;
    }
  }
}
```

`collectEffectList`接受两个参数，第一个是父 fiber 节点，第二个是当前需要处理的 fiber 节点。

`父fiber` 的 `firstEffect` 和 `lastEffect`保存的是一条单向链表，这条链表主要是有一个个的子 fiber 节点组成。

副作用链收集完成了之后，即`completeUnitOfWork`方法里面的 `workInProgress` 为 `null` 了 就会去执行 commitRoot，也就是我们说的提交阶段。
