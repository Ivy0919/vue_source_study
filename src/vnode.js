const VNodesFlags = {
    // html标签
    ELEMENT_HTML: 1,
    // svg标签
    ELEMENT_SVG: 1 << 1,

    // 普通有状态组件
    COMPONENT_STATEFUL_NORMAL: 1 << 2,
    // 需要被keepAlive的有状态组件
    COMPONENT_STATEFUL_SHOULD_KEEP_ALIVE: 1 << 3,
    // 已经被keepAlive的有状态组件
    COMPONENT_STATEFUL_KEPT_ALIVE: 1 << 4,
    // 函数组件
    COMPONENT_FUNCTIONAL: 1 << 5,

    // 纯文本
    TEXT: 1 << 6,
    // Fragment
    FRAGMENT: 1 << 7,
    // Portal
    PORTAL: 1 << 8
}
// 普通标签
VNodesFlags.ELEMENT = VNodesFlags.ELEMENT_HTML | VNodesFlags.ELEMENT_SVG;
// 状态组件
VNodesFlags.COMPONENT_STATEFUL = VNodesFlags.COMPONENT_STATEFUL_NORMAL | VNodesFlags.COMPONENT_STATEFUL_SHOULD_KEEP_ALIVE | VNodesFlags.COMPONENT_STATEFUL_KEPT_ALIVE;
// 组件
VNodesFlags.COMPONENT = VNodesFlags.COMPONENT_STATEFUL | VNodesFlags.COMPONENT_FUNCTIONAL

const ChildrenFlags = {
    // 未知的children类型
    UNKNOWN_CHILDREN: 0,
    // 没有children
    NO_CHILDREN: 1,
    // children是单个 VNode
    SINGLE_VNODE: 1 << 1,

    // children 是多个拥有key的VNode
    KEYED_VNODES: 1 << 2,
    // children 是多个没有 key 的VNode
    NONE_KEYED_VNODES: 1 << 3
}
// 多个节点
ChildrenFlags.MULTIPLE_VNODES = ChildrenFlags.KEYED_VNODES | ChildrenFlags.NONE_KEYED_VNODES;
const Fragment = Symbol();
const Portal = Symbol();

// 为children 添加key
function normalizeVNodes(children) {
    const newChildren = [];
    for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (child.key === undefined || child.key === null) {
            child.key = '|' + i;
        }
        newChildren.push(child)
    }
    return newChildren
}

function createTextVNode(text) {
    return {
        _isVNode: true,
        flags: VNodesFlags.TEXT,
        tag: null,
        data: null,
        children: text,
        childFlags: ChildrenFlags.NO_CHILDREN
    }
}

function h(tag, data = null, children = null) {
    let flags = null;
    let childFlags = null;
    if (typeof tag === 'string') {
        flags = tag === 'svg' ? VNodesFlags.ELEMENT_SVG : VNodesFlags.ELEMENT_HTML;
    } else if (tag === Fragment) {
        flags = VNodesFlags.FRAGMENT;
    } else if (tag === Portal) {
        flags = VNodesFlags.PORTAL;
        tag = data && data.target;
    } else {
        // component 兼容 Vue2 的对象式组件
        if (tag !== null && typeof tag === 'object') {
            // 判断是函数组件还是状态组件
            flags = tag.functional ? VNodesFlags.COMPONENT_FUNCTIONAL : VNodesFlags.COMPONENT_STATEFUL_NORMAL
        } else if (typeof tag === 'function') {
            flags = tag.prototype && tag.prototype.render ? VNodesFlags.COMPONENT_STATEFUL_NORMAL : VNodesFlags.COMPONENT_FUNCTIONAL;
        }
    }
    // children
    if (Array.isArray(children)) {
        const {
            length
        } = children;
        if (length === 0) {
            // 没有子节点
            childFlags = ChildrenFlags.NO_CHILDREN;
        } else if (length === 1) {
            // 单个子节点
            childFlags = ChildrenFlags.SINGLE_VNODE;
            children = children[0];
        } else {
            // 多个子节点，且有key
            childFlags = ChildrenFlags.MULTIPLE_VNODES;
            children = normalizeVNodes(children)
        }
    } else if (children === null) {
        // 没有子节点
        childFlags = ChildrenFlags.NO_CHILDREN;
    } else if (children._isVNode) {
        childFlags = ChildrenFlags.SINGLE_VNODE;
    } else {
        // 其他情况都作为文本节点处理，即单个子节点，会调用 createTextVNode 创建纯文本类型的 VNode
        childFlags = ChildrenFlags.SINGLE_VNODE;
        children = createTextVNode(children + '')
    }
    if (data && data.class) {
        const className = data.class
        data.class = normalizeClassName(className)
    }
    return {
        _isVNode: true,
        flags,
        tag,
        data,
        children,
        childFlags
    }
}

function normalizeClassName(className) {
    let str = '';
    if (Array.isArray(className)) {
        for (let i = 0; i < className.length; i++) {
            if (typeof className[i] === 'string') {
                str += className[i] + ' '
            } else {
                str += normalizeClassName(className[i])
            }
        }
    } else if (className instanceof Object) {
        for (let key in className) {
            if (className[key]) {
                str += key + ' '
            }
        }
    } else {
        str = className;
    }
    // 去除最后一个空格
    str = str.replace(/ $/, '')
    return str;
}

function render(vnode, container) {
    const prevVNode = container.vnode;
    if (prevVNode === undefined || prevVNode === null) {
        if (vnode) {
            mount(vnode, container);
            container.vnode = vnode;
        }
    } else {
        if (vnode) {
            // 有旧的 VNode，也有新的 VNode。则调用 `patch` 函数打补丁
            patch(prevVNode, vnode, container);
            container.vnode = vnode;
        } else {
            container.removeChild(prevVNode.el)
            container.vnode = null;
        }
    }
}
// 挂载
function mount(vnode, container, isSVG = false, refNode) {
    const {
        flags
    } = vnode;
    if (flags & VNodesFlags.ELEMENT) {
        // 普通html
        mountElement(vnode, container, isSVG, refNode)
    } else if (flags & VNodesFlags.COMPONENT) {
        // 挂载组件
        mountComponent(vnode, container, isSVG)
    } else if (flags & VNodesFlags.TEXT) {
        // 挂载文本
        mountText(vnode, container, isSVG)
    } else if (flags & VNodesFlags.FRAGMENT) {
        // 挂载fragment
        mountFragment(vnode, container, isSVG)
    } else if (flags & VNodesFlags.PORTAL) {
        // 挂载 portal
        mountPortal(vnode, container, isSVG)
    }
}

const domPropsRE = /\[A-Z]|^(?:value|checked|selected|muted)$/
// 挂载普通标签 其 el 属性值为真实DOM元素的引用
function mountElement(vnode, container, isSVG, refNode) {
    isSVG = isSVG || vnode.flags & VNodesFlags.ELEMENT_SVG;
    const el = isSVG ? document.createElementNS('http://www.w3.org/2000/svg', vnode.tag) : document.createElement(vnode.tag)
    // vnodeData
    const {
        data,
        children,
        childFlags
    } = vnode;
    if (data) {
        for (let key in data) {
            patchData(el, key, null, data[key])
        }
    }
    // 无子节点无需递归挂载，svg的子节点也是svg 
    if (childFlags !== ChildrenFlags.NO_CHILDREN) {
        if (childFlags & ChildrenFlags.SINGLE_VNODE) {
            // 单个节点, 这里需要把 isSVG 传递下去
            mount(children, el, isSVG)
        } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
            // 多个节点，这里需要把 isSVG 传递下去
            for (let i = 0; i < children.length; i++) {
                mount(children[i], el, isSVG)
            }
        }
    }
    vnode.el = el;
    refNode ? container.insertBefore(vnode, refNode) : container.appendChild(el)
}
// 挂载文本 其 el 属性值为文本元素的引用
function mountText(vnode, container) {
    const el = document.createTextNode(vnode.children);
    vnode.el = el;
    container.appendChild(el)
}
// 挂载组件 其 el 属性值为组件本身所渲染真实DOM的根元素
function mountComponent(vnode, container, isSVG) {
    const {
        flags
    } = vnode;
    if (flags & VNodesFlags.COMPONENT_STATEFUL) {
        // 有状态组件
        mountStatefulComponent(vnode, container, isSVG);
    } else {
        // 函数组件
        mountFunctionalComponent(vnode, container, isSVG);
    }
}
// 挂载有状态组件
function mountStatefulComponent(vnode, container, isSVG) {
    // 创建组件实例
    const instance = (vnode.children = new vnode.tag());
    //  初始化 props
    instance.$props = vnode.data;
    instance._update = function () {
        if (instance._mounted) {
            // 更新
            const prevVNode = instance.$vnode;
            const nextVNode = (instance.$vnode = instance.render())
            patch(prevVNode, nextVNode, prevVNode.el.parentNode)
        } else {
            // 挂载
            // 渲染VNode，通过render获取到实例的vnode
            instance.$vnode = instance.render();
            // 挂载
            mount(instance.$vnode, container, isSVG)
            // 组件已挂载的标识
            instance._mounted = true;

            // 调用 mounted 钩子
            instance.mounted && instance.mounted();
        }
        // el 属性值 和 组件实例的 $el 属性都引用组件的根DOM元素
        instance.$el = vnode.el = instance.$vnode.el;
    }
    instance._update();
}
// 挂载函数组件
function mountFunctionalComponent(vnode, container, isSVG) {
    // 在函数式组件类型的 vnode 上添加 handle 属性，它是一个对象
    vnode.handle = {
        prev: null,
        next: vnode,
        container,
        update: () => {
            if (vnode.handle.prev) {
                const prevVNode = vnode.handle.prev;
                const nextVNode = vnode.handle.next;
                const props = nextVNode.data;
                const prevTree = prevVNode.children;
                const nextTree = (nextVNode.children = nextVNode.tag(props));
                // 调用Patch
                patch(prevTree, nextTree, vnode.handle.container)
            } else {
                // 获取 props
                const props = vnode.data;
                // 获取 VNode
                const $vnode = (vnode.children = vnode.tag(props));
                // 挂载
                mount($vnode, container, isSVG);
                vnode.el = $vnode.el;
            }
        },
    }
    vnode.handle.update();
}

// 挂载fragment 其 el 属性值为片段中第一个DOM元素的引用
function mountFragment(vnode, container, isSVG) {
    const {
        children,
        childFlags
    } = vnode;
    if (children) {
        switch (childFlags) {
            case ChildrenFlags.NO_CHILDREN:
                // 如果没有子节点，等价于挂载空片段，会创建一个空的文本节点占位
                const placeholder = document.createTextNode('');
                container.appendChild(placeholder)
                vnode.el = placeholder;
                break;
            case ChildrenFlags.SINGLE_VNODE:
                // 单节点
                mount(children, container, isSVG);
                vnode.el = children.el;
                break;
            case ChildrenFlags.MULTIPLE_VNODES:
                // 多个节点
                for (let i = 0; i < children.length; i++) {
                    mount(children[i], container, isSVG)
                }
                vnode.el = children[0].el
        }
    }
}
// 挂载 portal Portal 比较特殊，根据 Portal 寓意，其内容可以被渲染到任何地方，但其真正的挂载点会有一个空文本节点占位，所以 Portal 的 VNode.el 属性值引用的始终是这个空文本节点
function mountPortal(vnode, container, isSVG) {
    const {
        tag,
        children,
        childFlags
    } = vnode;
    console.log(document.querySelector('#new-container'))
    console.log(document.querySelector(tag))
    const target = typeof tag === 'string' ? document.querySelector(tag) : tag
    if (childFlags & ChildrenFlags.SINGLE_VNODE) {
        // 单节点
        mount(children, target, isSVG)
        vnode.el = target;
    } else if (childFlags & ChildrenFlags.MULTIPLE_VNODES) {
        // 多节点
        for (let i = 0; i < children.length; i++) {
            mount(children[i], target, isSVG)
        }
    }

    const placeholder = document.createTextNode('');
    container.appendChild(placeholder)
    vnode.el = placeholder
}

// 打补丁
function patch(prevVNode, nextVNode, container) {
    const prevFlags = prevVNode.flags;
    const nextFlags = nextVNode.flags;
    console.log(nextFlags & VNodesFlags.ELEMENT)
    console.log(nextFlags & VNodesFlags.TEXT)
    // 检查新旧 VNode 的类型是否相同，如果类型不同，则直接调用 replaceVNode 函数替换 VNode
    // 如果新旧 VNode 的类型相同，则根据不同的类型调用不同的比对函数
    if (prevFlags !== nextFlags) {
        replaceVNode(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodesFlags.ELEMENT) {
        // 普通标签
        patchElement(prevVNode, nextVNode, container);
    } else if (nextFlags & VNodesFlags.COMPONENT) {
        // 组件
        patchComponent(prevVNode, nextVNode, container)
    } else if (nextFlags & VNodesFlags.TEXT) {
        // 文本
        patchText(prevVNode, nextVNode)
    } else if (nextFlags & VNodesFlags.FRAGMENT) {
        // fragment
        patchFragment(prevVNode, nextVNode, container)
    } else if (nextFlags & VNodesFlags.PORTAL) {
        // portal
        patchPortal(prevVNode, nextVNode)
    }
}
// 替换VNode
function replaceVNode(prevVNode, nextVNode, container) {
    // 将旧的 VNode 所渲染的 DOM 从容器中移除
    container.removeChild(prevVNode.el);
    // 如果将要被移除的 VNode 类型是组件，则需要调用该组件实例的 unmounted 钩子函数
    if (prevVNode.flags & VNodesFlags.COMPONENT_STATEFUL_NORMAL) {
        // 类型为有状态组件的 VNode，其 children 属性被用来存储组件实例对象
        const instance = prevVNode.children;
        instance.unmounted && instance.unmounted();
    }
    // 再把新的 VNode 挂载到容器中
    mount(nextVNode, container);
}
// patch普通标签
function patchElement(prevVNode, nextVNode, container) {
    // tag不同，直接替换
    if (prevVNode.tag !== nextVNode.tag) {
        replaceVNode(prevVNode, nextVNode, container)
    } else {
        // 相同，则需对比VNodeData和Children;
        // 拿到 el 元素，注意这时要让 nextVNode.el 也引用该元素
        const el = nextVNode.el = prevVNode.el;
        const prevData = prevVNode.data;
        const nextData = nextVNode.data;
        if (nextData) {
            // 更新新数据
            for (let key in nextData) {
                const prevValue = prevData[key];
                const nextValue = nextData[key];
                patchData(el, key, prevValue, nextValue);
            }
            // 移除掉没有的旧数据
            for (let key in prevData) {
                const prevValue = prevData[key];
                if (!nextData.hasOwnProperty(key)) {
                    patchData(el, key, prevValue, null);
                }
            }
        }

        patchChildren(prevVNode.childFlags, nextVNode.childFlags, prevVNode.children, nextVNode.children, el);
    }

}

function patchChildren(prevChildFlags, nextChildFlags, prevChildren, nextChildren, container) {
    switch (prevChildFlags) {
        // 没有子节点
        case ChildrenFlags.NO_CHILDREN:
            switch (nextChildFlags) {
                case ChildrenFlags.SINGLE_VNODE:
                    mount(nextChildren, container); //挂载
                    break;
                case ChildrenFlags.NO_CHILDREN:
                    break;
                default:
                    for (let i = 0; i < nextChildren.length; i++) {
                        mount(nextChildren[i], container); //挂载
                    }
            }
            break;
        case ChildrenFlags.SINGLE_VNODE:
            // 单个节点
            switch (nextChildFlags) {
                case ChildrenFlags.SINGLE_VNODE:
                    patch(prevChildren, nextChildren, container); //更新
                    break;
                case ChildrenFlags.NO_CHILDREN:
                    container.removeChild(prevChildren.el);
                    break;
                default:
                    container.removeChild(prevChildren.el) //移除单个节点
                    for (let i = 0; i < nextChildren.length; i++) {
                        mount(nextChildren[i], container); //挂载
                    }
            }
            break;
        case ChildrenFlags.MULTIPLE_VNODES:
            // 多个节点
            switch (nextChildFlags) {
                case ChildrenFlags.SINGLE_VNODE:
                    for (let i = 0; i < prevChildren.length; i++) {
                        container.removeChild(prevChildren[i].el)
                    }
                    mount(nextChildren, container); //挂载
                    break;
                case ChildrenFlags.NO_CHILDREN:
                    for (let i = 0; i < prevChildren.length; i++) {
                        container.removeChild(prevChildren[i].el)
                    }
                    break;
                default:
                    // 遍历新的children
                    // 用来存储寻找过程中遇到的最大索引值
                    // React 所采用的 Diff 算法
                    let lastIndex = 0
                    for (let i = 0; i < nextChildren.length; i++) {
                        const nextVNode = nextChildren[i];
                        let find = false;
                        for (let j = 0; j < prevChildren.length; j++) {
                            const prevVNode = prevChildren[j];
                            if (nextVNode.data.key === prevVNode.data.key) {
                                find = true;
                                patch(prevVNode, nextVNode, container);
                                if (j < lastIndex) {
                                    // 需要移动
                                    // refNode 是为了下面调用 insertBefore 函数准备的
                                    const refNode = nextChildren[i - 1].el.nextSibling;
                                    container.insertBefore(prevVNode.el, refNode)
                                } else {
                                    // 更新lastIndex;
                                    lastIndex = j;
                                }
                                break;
                            }
                            // 移除没有的节点
                            const has = nextChildren.find(node=>node.data.key=== prevVNode.data.key)
                            if(!has){
                                container.removeChild(prevVNode.el)
                            }
                        }
                        if (!find) {
                            // 新节点更新
                            const refNode = i - 1 < 0 ? prevChildren[0].el : nextChildren[i - 1].el.nextSibling
                            mount(nextVNode, container, false, refNode)
                        }
                    }
            }
            break;
    }
}

//prevValue为 VNodeData的key value值， nextValue依然，key为VNodeData的key, el为修改的标签元素 
function patchData(el, key, prevValue, nextValue) {
    switch (key) {
        case 'style':
            if (nextValue) {
                for (let k in nextValue) {
                    el.style[k] = nextValue[k]
                }
            } else {
                el.removeAttribute(key)
            }
            // 遍历旧 VNodeData 中的 style 数据，将已经不存在于新的 VNodeData 的数据移除
            if (prevValue) {
                for (let k in prevValue) {
                    if (!nextValue.hasOwnProperty(k)) {
                        el.style[k] = ''
                    }
                }
            }

            break;
        case 'class':
            if (nextValue) {
                el.className = nextValue
            } else {
                el.removeAttribute(key)
            }
            break;
        default:
            // 对nextData现有的更新
            if (key[0] === 'o' && key[1] === 'n') {
                // 移除旧事件
                if (prevValue) {
                    el.removeEventListener(key.slice(2), prevValue)
                }
                if (nextValue) {
                    el.addEventListener(key.slice[2], nextValue);
                }
            } else if (domPropsRE.test(key)) {
                el[key] = nextValue
            } else {
                el.setAttribute(key, nextValue)
            }
    }
}
// patch组件
function patchComponent(prevVNode, nextVNode, container) {
    // tag 属性的值是组件类，通过比较新旧组件类是否相等来判断是否是相同的组件
    if (nextVNode.tag !== prevVNode.tag) {
        replaceVNode(prevVNode, nextVNode, container)
    } else if (nextVNode.flags & VNodesFlags.COMPONENT_STATEFUL_NORMAL) {
        // 是否为有状态组件
        // 获取实例
        const instance = (nextVNode.children = prevVNode.children)
        instance.$props = nextVNode.data;
        // 更新组件
        instance._update();
    } else {
        // 更新函数式组件
        // 通过 prevVNode.handle 拿到 handle 对象
        const handle = (nextVNode.handle = prevVNode.handle)
        handle.prev = prevVNode;
        handle.next = nextVNode;
        handle.container = container;

        // 调用 update 函数完成更新
        handle.update();
    }
}
// patch文本
function patchText(prevVNode, nextVNode) {
    // 拿到文本元素 el，同时让 nextVNode.el 指向该文本元素
    const el = nextVNode.el = prevVNode.el;
    if (nextVNode.children !== prevVNode.children) {
        el.nodeValue = nextVNode.children;
    }
}
// patch Fragment
function patchFragment(prevVNode, nextVNode, container) {
    // 直接调用 patchChildren 函数更新 新旧片段的子节点即可
    patchChildren(prevVNode.childFlags, nextVNode.childFlags, prevVNode.children, nextVNode.children, container)
    switch (nextVNode.ChildrenFlags) {
        case ChildrenFlags.NO_CHILDREN:
            nextVNode.el = prevVNode.el; break;
        case ChildrenFlags.SINGLE_VNODE:
            nextVNode.el = nextVNode.children.el; break;
        default:
            nextVNode.el = nextVNode.children[0].el;
    }
}
// patch Portal 根据 Portal 寓意，其内容可以被渲染到任何地方，但其真正的挂载点会有一个空文本节点占位，所以 Portal 的 VNode.el 属性值引用的始终是这个空文本节点
function patchPortal(prevVNode, nextVNode) {
    patchChildren(prevVNode.childFlags, nextVNode.childFlags, prevVNode.children, nextVNode.children, prevVNode.tag)
    // 让 nextVNode.el 指向 prevVNode.el
    nextVNode.el = prevVNode.el
    // 如果新旧容器不同，才需要搬运
    if (nextVNode.tag !== prevVNode.tag) {
        const container = typeof nextVNode.tag === 'string' ? document.querySelector(nextVNode.tag) : nextVNode.tag;
        switch (nextVNode.childFlags) {
            case ChildrenFlags.NO_CHILDREN: break;
            case ChildrenFlags.SINGLE_VNODE:
                container.appendChild(nextVNode.children.el); break;
            default:
                // 如果新的 Portal 是多个子节点，遍历逐个将它们搬运到新容器中
                for (let i = 0; i < nextVNode.children.length; i++) {
                    container.appendChild(nextVNode.children[i].el)
                }
                break;
        }
    }
}
