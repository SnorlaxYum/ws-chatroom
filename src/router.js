import Vue from 'vue'
import VueRouter from 'vue-router'

Vue.use(VueRouter)

export default new VueRouter({
    routes: [
        {
            path: '/rtc',
            name: 'rtc',
            component: () => import('./views/WebRTC.vue')
        }
    ]
})