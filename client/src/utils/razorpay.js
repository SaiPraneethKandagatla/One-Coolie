/**
 * client/src/utils/razorpay.js
 *
 * Frontend Razorpay Checkout script loader & utility helper.
 * Ensures https://checkout.razorpay.com/v1/checkout.js is loaded dynamically if not yet ready.
 */

export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) {
      return resolve(true);
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
