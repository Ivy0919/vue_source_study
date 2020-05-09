

// 有状态组件 VNode
const prev = h('div', {
  text: this.localState
}, [
  h('li', { key: 'a' }, 1),
  h('li', { key: 'b' }, 2),
  h('li', { key: 'c' }, 3)
]);
const next = h('div', {
  text: this.localState
}, [
  h('li', { key: 'c' }, 3),
  h('li', { key: 'a' }, 1)
]);
render(prev, document.getElementById('app'))
setTimeout(function(){
  render(next, document.getElementById('app'))
},2000)