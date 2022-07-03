## 递阶段

在 render 的过程中分为`递`和`归阶段`，`递`阶段就是 beginWork，`归`阶段就是 completeWork 阶段

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
