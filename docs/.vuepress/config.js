module.exports = {
    title: '前端程序猿进阶之秘籍',
    description: '前端技术相关的文章，包含不限于vue，react，webpack，nodejs，算法等等',
    logo: '/assets/img/logo.png',
    themeConfig:{
        nav: [
            { text: 'Home', link: '/' },
            // { text: 'Guide', link: '/guide/' },
            { text: 'External', link: 'https://google.com' },
          ],
          sidebar: [
            [ '/','主页'],
            {
                title: "算法",
                collapsable: true,
                children: [
                    ['/Algorithm/算法复杂度分析','算法复杂度分析'],
                ]
            },
            {
                title: "JavaScript",
                collapsable: true,
                children: [
                    ['/JavaScript/你真的懂闭包吗','你真的懂闭包吗'],
                ]
            },
            {
                title: "React技术研究",
                collapsable: true,
                children: [
                    {
                        title:'React Fiber',
                        collapsable: true,
                        children:[
                            ['/React/React-Fiber/ReactFiber架构','Fiber架构'],
                            ['/React/React-Fiber/React中的事件优先级调度','React事件优先级调度'],
                        ]
                    }
                ]
            },
         
          ]
    }
  }