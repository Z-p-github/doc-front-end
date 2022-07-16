## 递阶段

在 render 的过程中分为`递`和`归阶段`，`递`阶段就是 beginWork，`归`阶段就是 completeWork 阶段。

递阶段首先从 rootFiber 开始向下深度优先遍历。为遍历到的每个 Fiber 节点调用 beginWork 方法 (opens new window)。

该方法会根据传入的 Fiber 节点创建子 Fiber 节点，并将这两个 Fiber 节点连接起来。

当遍历到叶子节点（即没有子组件的组件）时就会进入“归”阶段。

#

## 首次 mount 阶段

在首次 mount 的时候，如下所示：

```js
let element = (
  <div key="title" id="title">
    title
  </div>
);
ReactDOM.render(element, document.getElementById("root"));
```

这个时候 fiber 树是还没有生成的，所以我们需要根据传入进来的根结点`root`生成一个`hostRootFiber`，即根节点对应的 fiber 节点，在初始化的时候，还需要去初始化 fiber 上面的更新链表，即`updateQueue`，第一次的更新链表指向为空 ,生成的根 fiber 为：

![rootFiber](@assets/rootFiber.png "rootFiber")

## 更新容器

在我们创建了 root Fiber 之后，我们就要去更新容器，将`element`挂载到根节点里面去。

```js
function render(element, container) {
  //创建根fiber
  let fiberRoot = createFiberRoot(container);
  //去更新容器
  updateContainer(element, fiberRoot);
}
```

这个时候我们会去创建一个更新对象：更新对象的`payload`就是本次需要插入的元素，也就是上文的`element`

```js
export function updateContainer(element, container) {
  //获取hostRootFiber fiber根的根节点
  //正常来说一个fiber节点会对应一个真实DOM节点，hostRootFiber对应的DOM节点就是containerInfo div#root
  const current = container.current;
  //创建一个更新对象
  const update = createUpdate();
  update.payload = { element };
  //将生成的更新对象插入到root fiber的更新队列中去
  enqueueUpdate(current, update);
  //调度更新
  scheduleUpdateOnFiber(current);
}
```

更新对象如图：

<img src='@assets/update.png'  height = "200" alt="update" />

接下来我们需要把这个 update 插入到 rootFiber 的更新队列中去，便于后续的一个更新，rootFiber 的更新队列是一个环状链表，它的`pending`属性始终指向最新的一次更新，如下图

![pending](@assets/next.png "pending")

有了更新队列 updateQueue 之后，我们就要去调度更新了。

这个时候，其实 react 内部会去执行一个叫做`performSyncWorkOnRoot`的方法，这个方法的意思就是在根上`root`执行同步的工作，

执行`performSyncWorkOnRoot`方法的时候，react 内部会去创建一个 workInProgressFiber

## workInProgress 双缓存 Fiber 树

在`React`中最多会同时存在两棵`Fiber树`。当前屏幕上显示内容对应的`Fiber树`称为`current Fiber树`，正在内存中构建的`Fiber树`称为`workInProgress Fiber树`。

`current Fiber树`中的`Fiber节点`被称为`current fiber`，`workInProgress Fiber树`中的`Fiber节点`被称为`workInProgress fiber`，他们通过`alternate`属性连接。

```js
currentFiber.alternate === workInProgressFiber;
workInProgressFiber.alternate === currentFiber;
```

`React`应用的根节点通过使`current`指针在不同`Fiber树`的`rootFiber`间切换来完成`current Fiber`树指向的切换。

即当`workInProgress Fiber树`构建完成交给`Renderer`渲染在页面上后，应用根节点的`current`指针指向`workInProgress Fiber树`，此时`workInProgress Fiber树`就变为`current Fiber树`。

每次状态更新都会产生新的`workInProgress Fiber树`，通过`current`与`workInProgress`的替换，完成`DOM`更新。

## 开始构建副作用链

```js
function performSyncWorkOnRoot(fiberRoot) {
  workInProgressRoot = fiberRoot;
  workInProgress = createWorkInProgress(workInProgressRoot.current);
  workLoopSync(); //执行工作循环，构建副作用链
  commitRoot(); //提交，修改DOM
}
```

`react`内部会执行一个 `performUnitOfWork`方法去构建副作用链，`performUnitOfWork`内部回去调用`beginWork`方法

在 beginwork 方法内部会根据 workInProgressFiber 的 tag 来判断当前 fiber 的类型是什么

```js
//开始构建当前fiber的子fiber链表
//它会返回下一个要处理的fiber,一般都是unitOfWork的大儿子
export function beginWork(current, workInProgress) {
  switch (workInProgress.tag) {
    case HostRoot: //根fiber
      return updateHostRoot(current, workInProgress);
    case HostComponent: //原生组件的fiber span div p
      return updateHostComponent(current, workInProgress);
    default:
      break;
  }
}
```

我们先来看看`updateHostRoot`方法：，在这个方法里面回去找到根节点的 nextChildren，然后会去调用 reconcileChildren 去处理子节点，根据老 fiber 和新的虚拟 DOM 进行对比，创建新的 fiber 树。
reconcileChildren 方法也称为调和阶段，在这个阶段会去调和每一个子元素，并且会去创建子元素的 fiber 节点，并且创建好了 fiber 节点之后，会然后子 fiber 的 return 属性指向父 fiber：

```js
/**
 * 根据虚拟DOM元素创建fiber节点
 * @param {*} element
 */
export function createFiberFromElement(element) {
  const { key, type, props } = element;
  let tag;
  if (typeof type === "string") {
    // span div p
    tag = HostComponent; //标签等于原生组件
  }
  const fiber = createFiber(tag, props, key);
  fiber.type = type;
  return fiber;
}

function reconcileSingleElement(returnFiber, currentFirstChild, element) {
  //创建子fiber
  const created = createFiberFromElement(element); //div#title
  //return属性指向父fiber
  created.return = returnFiber;
  return created;
}
```

然后会给这个元素打上一个标记，表示将来的某一时刻会去插入这个元素：

```js
function placeSingleChild(newFiber) {
  //如果当前需要跟踪父作用，并且当前这个新的fiber它的替身不存在
  if (shouldTrackSideEffects && !newFiber.alternate) {
    //给这个新fiber添加一个副作用，表示在未来提前阶段的DOM操作中会向真实DOM树中添加此节点
    newFiber.flags = Placement;
  }
  return newFiber;
}
```

接下来会把返回的第一个子元素的 fiber 节点赋值给`workInProgress`，然后在`workLoopSync`函数里面继续执行子 fiber 的创建，
如果节点只是一个数字或者字符串，就设置它的文本内容就行。不需要创建子 fiber 节点

`beginWork` 阶段主要是遍历父节点的 `child` 节点，然后为每一个 `child` 生成一个对应的 fiber 节点

如果当前 fiber 没有子 fiber,那么当前的 fiber 就算完成，这个时候就会去调用 completeUnitOfWork 方法

<strong>也就是我们说的归阶段</strong>

## 摘抄

## reconcileChildren

从该函数名就能看出这是`Reconciler`模块的核心部分。那么他究竟做了什么呢？

- 对于`mount`的组件，他会创建新的`子Fiber节点`

- 对于`update`的组件，他会将当前组件与该组件在上次更新时对应的`Fiber节点`比较（也就是俗称的`Diff`算法），将比较的结果生成新`Fiber节点`

```js
export function reconcileChildren(
  current: Fiber | null,
  workInProgress: Fiber,
  nextChildren: any,
  renderLanes: Lanes
) {
  if (current === null) {
    // 对于mount的组件
    workInProgress.child = mountChildFibers(
      workInProgress,
      null,
      nextChildren,
      renderLanes
    );
  } else {
    // 对于update的组件
    workInProgress.child = reconcileChildFibers(
      workInProgress,
      current.child,
      nextChildren,
      renderLanes
    );
  }
}
```

从代码可以看出，和`beginWork`一样，他也是通过`current === null ?`区分`mount`与`update`。

不论走哪个逻辑，最终他会生成新的子`Fiber节点`并赋值给`workInProgress.child`，作为本次`beginWork`[返回值](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberBeginWork.new.js#L1158)，并作为下次`performUnitOfWork`执行时`workInProgress`的[传参](https://github.com/facebook/react/blob/1fb18e22ae66fdb1dc127347e169e73948778e5a/packages/react-reconciler/src/ReactFiberWorkLoop.new.js#L1702)。

::: warning 注意
值得一提的是，`mountChildFibers`与`reconcileChildFibers`这两个方法的逻辑基本一致。唯一的区别是：`reconcileChildFibers`会为生成的`Fiber节点`带上`effectTag`属性，而`mountChildFibers`不会。
:::
