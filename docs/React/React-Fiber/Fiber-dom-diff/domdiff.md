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

2、新的节点是一个多节点，有很多个节点，但是如果
