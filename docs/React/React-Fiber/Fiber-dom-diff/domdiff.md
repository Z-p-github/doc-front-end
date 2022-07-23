## DOM DIFF

`react dom diff`分很多中情况，diff 阶段主要是在`beginWork`的 `reconcileChildren`方法中进行,`reconcileChildren`方法接受三个参数

```js
//参数分别是 1、老的fiber节点，2、新的构建中的fiber节点，新的fiber节点的child节点
function reconcileChildren(current, workInProgress, nextChildren) {}
```

我们主要从以下几种情况入手

## 新的节点是单节点

1、新的节点是一个单节点，就是只有一个节点的意思
只有一个单节点的情况下，会去执行 `reconcileSingleElement` 这个方法，这个方法接受三个参数

```js
function deleteRemainingChildren(returnFiber, childToDelete) {
  while (childToDelete) {
    deleteChild(returnFiber, childToDelete);
    childToDelete = childToDelete.sibling;
  }
}
/**
 * 协调单节点
 * @param {*} returnFiber  新的父fiber
 * @param {*} currentFirstChild 第一个旧fiber
 * @param {*} element 新的要渲染的虚拟DOM是一个原生DOM节点
 * @returns
 */
function reconcileSingleElement(returnFiber, currentFirstChild, element) {
  //获取新的虚拟DOM的key
  let key = element.key;
  //获取第一个老的fiber节点
  let child = currentFirstChild;
  while (child) {
    //老fiber的ekey和新的虚拟DOM的key相同说明
    if (child.key === key) {
      //判断老的fiber的type和新的虚拟DOMtype是否相同
      if (child.type == element.type) {
        //准备复用child老fiber节点，删除剩下的其它fiber
        deleteRemainingChildren(returnFiber, child.sibling);
        //在复用老fiber的时候，会传递新的虚拟DOM的属性对象到新fiber的pendingProps上
        const existing = useFiber(child, element.props);
        existing.return = returnFiber;
        return existing;
      } else {
        //已经配上key了，但是type不同，则删除包括当前的老fiber在内所所有后续的老fibe
        deleteRemainingChildren(returnFiber, child);
        break;
      }
    } else {
      //如果相同说明当前这个老fiber不是对应于新的虚拟DOM节点 把此老fiber标记为删除，并且继续弟弟
      deleteChild(returnFiber, child);
    }
    //继续匹配弟弟们
    child = child.sibling;
  }
  const created = createFiberFromElement(element); //div#title
  created.return = returnFiber;
  return created;
}
```

单节点里面，首先会去判断老的 `child fiber` 节点的 `key` 和新的 `element` 是不是一样的，如果不是就将老的节点标记为删除，依次去遍历兄弟节点 `child.sibling`。如果在老的 `fiber` 节点中找到了一个 `key` 和 `type` 都相等的 `fiber` 节点，则进行一个复用，根据老的子 `fiber` 节点和新的 `element` 的属性（props）生成一个新的 `fiber` 节点，并且进行一个 `return` 的指向，指向 `returnFiber`,然后会去删除老的节点上的其他`fiber`节点。

## 新的节点是多节点

首先他们会到这个方法中去进行一个 diff 操作

```js
/**
 * returnFiber 父fiber节点
 * currentFirstChild 老的第一个儿子节点
 * newChildren 新的儿子节点
 */
//这个方法里面会有不同条件下的三个循环操作
function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren) {
  //将要返回的第一个新fiber
  let resultingFirstChild = null;
  //上一个新fiber
  let previousNewFiber = null;
  //当前的老fiber
  let oldFiber = currentFirstChild;
  //下一个老fiber
  let nextOldFiber = null;
  //新的虚拟DOM的索引
  let newIdx = 0;
  //指的上一个可以复用的，不需要移动的节点的老索引
  let lastPlacedIndex = 0;
  //处理更新的情况 老fiber和新fiber都存在
  for (; oldFiber && newIdx < newChildren.length; newIdx++) {
    //先缓存下一个老fiber
    nextOldFiber = oldFiber.sibling;
    //试图复用才fiber
    const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx]);
    //如果key 不一样，直接跳出第一轮循环
    if (!newFiber) break; //跳出第一轮循环
    //老fiber存在，但是新的fiber并没有复用老fiber
    if (oldFiber && !newFiber.alternate) {
      deleteChild(returnFiber, oldFiber);
    }
    //核心是给当前的newFiber添加一个副作用flags 叫新增
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
    if (!previousNewFiber) {
      resultingFirstChild = newFiber; //resultingFirstChild=>li(A)
    } else {
      previousNewFiber.sibling = newFiber; //liB.sibling=li(C)
    }
    previousNewFiber = newFiber; //previousNewFiber=>li(C)
    oldFiber = nextOldFiber;
  }

  if (newIdx === newChildren.length) {
    //1!=6
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }
  //如果没有老fiber了
  if (!oldFiber) {
    //oldFIber现在指向B，有的，进不出
    //循环虚拟DOM数组， 为每个虚拟DOM创建一个新的fiber
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx]); //li(C)
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (!previousNewFiber) {
        resultingFirstChild = newFiber; //resultingFirstChild=>li(A)
      } else {
        previousNewFiber.sibling = newFiber; //liB.sibling=li(C)
      }
      previousNewFiber = newFiber; //previousNewFiber=>li(C)
    }
    return resultingFirstChild;
  }
  //将剩下的老fiber放入map中
  const existingChildren = mapRemainingChildren(returnFiber, oldFiber);
  for (; newIdx < newChildren.length; newIdx++) {
    //去map中找找有没key相同并且类型相同可以复用的老fiber 老真实DOM
    const newFiber = updateFromMap(
      existingChildren,
      returnFiber,
      newIdx,
      newChildren[newIdx]
    );
    if (newFiber) {
      //说明是复用的老fiber
      if (newFiber.alternate) {
        existingChildren.delete(newFiber.key || newIdx);
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      if (!previousNewFiber) {
        resultingFirstChild = newFiber; //resultingFirstChild=>li(A)
      } else {
        previousNewFiber.sibling = newFiber; //liB.sibling=li(C)
      }
      previousNewFiber = newFiber; //previousNewFiber=>li(C)
    }
  }
  //map中剩下是没有被 复用的，全部删除
  existingChildren.forEach((child) => deleteChild(returnFiber, child));
  return resultingFirstChild;
}
```

第一个循环，在 `updateSlot` 方法里面会先尝试的去复用老的 fiber，如果不能服用（key 不一样），会直接跳出第一个循环，如果可以复用

```js
//如果key一样，但是却没有复用老的fiber，判断有没有复用老的fiber，就是看这个fiber节点有没有alternate，因为如果可以复用老的fiber节点，源码里面会将 老的fiber节点和新的虚拟dom的新属性曲生成一个新的workInProgress fiber，老新节点节点之间会用alternate相互指向
//----所以下面这句话就是，如果老的fiber存在但是新生成的fiber却没有复用，那么就去删除老的fiber，给他添加一个删除的 `effectTag`
if (oldFiber && !newFiber.alternate) {
  deleteChild(returnFiber, oldFiber);
}

//placeChild方法中会去给新的fiber节点打上一个新增的`effectTag`,在这个里面也会去判断节点移动的情况
function placeChild(newFiber, lastPlacedIndex, newIdx) {
  newFiber.index = newIdx;
  if (!shouldTrackSideEffects) {
    return lastPlacedIndex;
  }
  const current = newFiber.alternate;
  //如果有current说是更新，复用老节点的更新，不会添加Placement
  if (current) {
    const oldIndex = current.index;
    //如果老fiber它对应的真实DOM挂载的索引比lastPlacedIndex小
    if (oldIndex < lastPlacedIndex) {
      //老fiber对应的真实DOM就需要移动了
      newFiber.flags |= Placement;
      return lastPlacedIndex;
    } else {
      //否则 不需要移动 并且把老fiber它的原来的挂载索引返回成为新的lastPlacedIndex
      return oldIndex;
    }
  } else {
    newFiber.flags = Placement;
    return lastPlacedIndex;
  }
}
```

在最后一个循环中，会将老的 fiber 节点，生成一个 map，以 key 为 map 对象的 key，fiber 节点为 map 的 value，然后每次循环的时候，用新的虚拟 dom 的 key 去里面查找，看看能不能复用，如果`alternate`存在说明能够复用，不存在话就调用`placeChild`方法去处理移动或者新增

<strong>每次`placeChild`的时候会给新的`fiber`节点绑定一个`index`属性，表示这个`fiber`节点在`child`的位置索引，当节点 diff 的时候，会用老 child 节点的 index 和新的循环里面 lastPlacedIndex(指的上一个可以复用的，不需要移动的节点的老索引)去进行比较，如果 fiber 节点可以服用，而且老 fiber 它对应的真实 DOM 挂载的索引比 lastPlacedIndex 小，那么老 fiber 对应的真实 DOM 就需要移动了</strong>

<strong>如果最后新的节点遍历完成了，但是老的 map 中还有数据，那么全部标记为删除</strong>

```js
//map中剩下是没有被 复用的，全部删除
existingChildren.forEach((child) => deleteChild(returnFiber, child));
```

<strong>节点在 diff 的过程中，会有一个单向链表去保存每一个 diff 完成了之后的 fiber 节点信息</strong>
这个方法里面有一个 `resultingFirstChild`变量，主要是用来保存我们 diff 好了的 fiber 链表
<img src='@assets/fiber-link.png' alt="fiber-link" />

### 1、第一种情况，老的是单节点，新的是多节点

<img src='@assets/singleDiff.png' alt="singleDiff"  height="300" />

- 这种情况会先走到第一个循环中去，发现第一个新的节点的 key 和老的`child`不一样，那么会跳出第一次循环，然后走到最后一次循环。

- 发现 D 节点和 老 A 节点 key 不一样 ，那么会给 D 节点打上一个 `Placement`的 `flag` ，然后接着循环

- 发现新的 A 节点和老的 A 节点可以复用，那么会用老的 A 的 fiber 节点和新的 A 的虚拟 dom 的 prop 属性生成一个新的 fiber 节点，并且修改这个 fiber 节点的 index 属性，按照最新的在 child 树中的位置就行赋值，并且将第一个新的 D 节点的 sibling 指向这个 A，也就是上面说的 `resultingFirstChild.sinling = A`

- 循环到 C，发现 `existingChildren`这个 map 数据里面没找到 C，说明不能复用，会直接给节点打上一个 `Placement`的 `flag` ，并且最后给 `resultingFirstChild`这个链表中就行 sibling 绑定

- 循环完了之后，会去给 map 中剩下的 fiber 节点打上删除的标记

```js
//map中剩下是没有被 复用的，全部删除
existingChildren.forEach((child) => deleteChild(returnFiber, child));
```

### 2、第二种情况，老的是多节点，新的也是多节点

<img src='@assets/multipleDiff.png' alt="multipleDiff"  height="300" />

- 发现 A 节点和 老 A 节点 key 可以复用 ，那么会根据老的 A 的 fiber 节点和新的 A 的虚拟 dom 的 prop 生成一个新的 fiber 节点，然后接着循环

- 循环到新的 C 节点的时候，会去在老的 map(existingChildren)中去找，发现有一个老的 C 节点可以复用，那么会根据老的 fiber 节点生成一个新的 fiber 节点，然后会去比较老的节点在兄弟节点中的 index，如果小于新的 index，那么这儿需要标记为移动，这儿不需要去移动，然后接着循环

- 发现 E 节点没办法复用 ，那么会直接去生成一个新的 fiber 节点，然后会标记为插入新增 flag=2

- 发现 B 节点和 老 B 节点 key 可以复用 ，那么会根据老的 B 的 fiber 节点和新的 B 的虚拟 dom 的 prop 生成一个新的 fiber 节点，然后比较 index 索引，发现需要移动，给新的 fiber 节点标记为移动

- G 和 D 都标记为新增

- 然后返回 diff 好了的 resultingFirstChild 这个单向链表
  <img src='@assets/singleLink.png' alt="singleLink"  height="300" />

这个时候就 diff 完成了，然后就会去走 complete 的流程
