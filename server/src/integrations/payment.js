import config from '../config.js'

// ===== 支付：可插拔服务商 =====
// 默认 mock：不接入真实支付，由调用方直接写入会员状态，本地即可跑通「付费墙」演示。
// 真实接入：把 PAYMENT_PROVIDER 设为 stripe / wechat，在下方实现创建订单 + 支付成功回调写入会员。

// ---------- mock 实现 ----------
async function checkoutMock({ planKey, days }) {
  // 模拟下单成功，返回订单号；真正的「开通会员」动作由调用方（index.js）在支付成功后执行。
  return {
    ok: true,
    mock: true,
    orderId: 'mock_' + Date.now(),
    paidAt: Date.now(),
    planKey,
    days,
  }
}

// ---------- 真实服务商接入点（示例：Stripe）----------
async function checkoutStripe({ planKey, plan, userId }) {
  // TODO: 创建 Stripe Checkout Session，返回跳转 URL；支付成功 Webhook 回调中调用 store.grantPlan(userId, ...)
  // const session = await stripe.checkout.sessions.create({ line_items: [...], mode: 'payment', success_url, cancel_url })
  // return { ok: true, url: session.url }
  throw new Error('PAYMENT_PROVIDER=stripe 尚未实现：请在 integrations/payment.js 接入 Stripe')
}

const impls = {
  mock: { checkout: checkoutMock },
  stripe: { checkout: checkoutStripe },
  // wechat: { checkout: (...)=>{...} }  // TODO: 微信支付（JSAPI / Native）
}

export function getPayment() {
  return impls[config.payment.provider] || impls.mock
}

export function isMockPayment() {
  return (config.payment.provider || 'mock') === 'mock'
}
