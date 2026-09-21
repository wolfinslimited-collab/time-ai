// First-party bootstrap so PageView is queued before React hydrates even when
// a browser or proxy refuses inline scripts.
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.id='meta-pixel-script';t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','1767429987632321');fbq('track','PageView');
window.timelessMetaPixelInitialized=true;
document.documentElement.dataset.timelessMetaPixelInitialized='true';
