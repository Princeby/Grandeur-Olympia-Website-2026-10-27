/* Interaction layer only; every page's content is present in its HTML. */
(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const store = {
    get(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    set(key,value) { try { sessionStorage.setItem(key,value); } catch { /* Storage can be unavailable in a local file preview. */ } }
  };
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const menuButton = $('.quiet-menu-toggle');
  const mobileNav = $('#quiet-mobile-nav');
  if (menuButton && mobileNav) {
    menuButton.hidden = false;
    const setMenu = open => {
      menuButton.setAttribute('aria-expanded',String(open));
      menuButton.setAttribute('aria-label',open?'Close navigation':'Open navigation');
      mobileNav.hidden = !open;
    };
    menuButton.addEventListener('click',()=>setMenu(menuButton.getAttribute('aria-expanded')!=='true'));
    mobileNav.addEventListener('click',event=>{ if(event.target.closest('a'))setMenu(false); });
    document.addEventListener('click',event=>{if(!event.target.closest('.quiet-header'))setMenu(false);});
    window.matchMedia?.('(min-width: 801px)').addEventListener('change',event=>{if(event.matches)setMenu(false);});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menuButton.getAttribute('aria-expanded')==='true'){setMenu(false);menuButton.focus();}});
  }

  const motionButton = $('[data-motion-toggle]');
  const setMotion = paused => {
    document.body.classList.toggle('is-motion-paused',paused);
    if(motionButton){motionButton.setAttribute('aria-pressed',String(paused));motionButton.querySelector('span').textContent=paused?'Resume motion':'Pause motion';}
    store.set('grandeur-motion-paused',String(paused));
    document.dispatchEvent(new CustomEvent('quiet-motion-change'));
  };
  setMotion(store.get('grandeur-motion-paused')==='true');
  motionButton?.addEventListener('click',()=>setMotion(!document.body.classList.contains('is-motion-paused')));
  const companyTrack = $('.quiet-company-track');
  const companyPause = $('[data-marquee-pause]');
  companyPause?.addEventListener('click',()=>{
    const paused=companyTrack.classList.toggle('is-paused');
    companyPause.setAttribute('aria-pressed',String(paused));
    companyPause.setAttribute('aria-label',paused?'Resume partner logos':'Pause partner logos');
  });

  if ('IntersectionObserver' in window && !prefersReduced?.matches) {
    document.documentElement.classList.add('quiet-enhanced');
    const observer = new IntersectionObserver(entries=>entries.forEach(entry=>{
      if(entry.isIntersecting){entry.target.classList.add('quiet-visible');observer.unobserve(entry.target);}
    }),{threshold:.07});
    $$('.quiet-reveal').forEach(el=>observer.observe(el));
  }

  /* ── Site-wide lazy-load for images using data-src ── */
  if ('IntersectionObserver' in window) {
    const lazyImages = $$('img[data-src]');
    if (lazyImages.length) {
      const imgObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          img.src = img.dataset.src;
          delete img.dataset.src;
          img.removeAttribute('data-src');
          img.addEventListener('load', () => img.classList.add('quiet-img-loaded'), { once: true });
          obs.unobserve(img);
        });
      }, { rootMargin: '200px 0px' });
      lazyImages.forEach(img => imgObserver.observe(img));
    }
  }

  const helpToggle = $('[data-help-toggle]');
  const helpPanel = $('#quiet-help-panel');
  function setHelp(open,focus=false){
    if(!helpPanel||!helpToggle)return;
    helpPanel.hidden=!open;helpToggle.setAttribute('aria-expanded',String(open));
    if(open&&focus)helpPanel.querySelector('a')?.focus();
  }
  helpToggle?.addEventListener('click',()=>setHelp(helpPanel.hidden));
  $('[data-help-close]')?.addEventListener('click',()=>{setHelp(false);helpToggle.focus();});
  document.addEventListener('click',event=>{if(!event.target.closest('.quiet-help'))setHelp(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&helpPanel&&!helpPanel.hidden){setHelp(false);helpToggle.focus();}});

  const dialog = $('#newsletter-dialog');
  let previousFocus=null;
  let autoPrompt;
  function openNewsletter(){
    if(!dialog||dialog.open)return;
    clearTimeout(autoPrompt);setHelp(false);
    previousFocus=document.activeElement;
    dialog.showModal();document.body.classList.add('quiet-modal-open');
    $('#newsletter-title')?.focus();
  }
  $$('[data-newsletter-open]').forEach(link=>link.addEventListener('click',event=>{
    if(!dialog?.showModal)return;event.preventDefault();openNewsletter();
  }));
  $$('[data-newsletter-close]').forEach(button=>button.addEventListener('click',()=>dialog?.close()));
  dialog?.addEventListener('close',()=>{
    store.set('grandeur-updates-seen','true');
    document.body.classList.remove('quiet-modal-open');
    previousFocus?.focus?.();
  });
  dialog?.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const box=dialog.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();
  });
  // Let visitors orient themselves before inviting them to request updates.
  if(dialog?.showModal&&store.get('grandeur-updates-seen')!=='true'){
    autoPrompt=setTimeout(()=>{
      if(document.hidden||document.querySelector('input:focus,textarea:focus,select:focus')||helpPanel&&!helpPanel.hidden)return;
      openNewsletter();store.set('grandeur-updates-seen','true');
    },9500);
  }
  const email='grandeurolympiaglobal@gmail.com';
  function composeEmail(subject,body){
    const target='mailto:'+email+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    window.location.href=target;
    return target;
  }
  const newsletterForm=$('[data-newsletter-form]');
  newsletterForm?.addEventListener('submit',event=>{
    event.preventDefault();
    if(!newsletterForm.reportValidity())return;
    const data=new FormData(newsletterForm);
    const body='Hello Grandeur Olympia,\n\nPlease add me to your company news and email updates.\n\nEmail: '+String(data.get('email')).trim()+'\n\nI consent to receiving Grandeur Olympia news and updates by email. I understand I can request removal by replying or contacting your company inbox.\n\nThank you.';
    const target=composeEmail('Newsletter subscription request',body);
    store.set('grandeur-updates-seen','true');
    $('[data-newsletter-status]').textContent='Your email app should open with your request. Send it there to complete your subscription request.';
    const fallback=$('[data-newsletter-fallback]');fallback.href=target;fallback.hidden=false;
  });
  const enquiryForm=$('[data-enquiry-form]');
  if(enquiryForm){
    const serviceSelect=$('#enquiry-service');
    const choice=new URLSearchParams(window.location.search).get('service');
    if([...serviceSelect.options].some(option=>option.value===choice))serviceSelect.value=choice;
    enquiryForm.addEventListener('submit',event=>{
      event.preventDefault();if(!enquiryForm.reportValidity())return;
      const data=new FormData(enquiryForm);
      const service=serviceSelect.options[serviceSelect.selectedIndex].textContent;
      const target=composeEmail(service+' enquiry - '+String(data.get('name')).trim(),'Hello Grandeur Olympia,\n\nName: '+String(data.get('name')).trim()+'\nEmail: '+String(data.get('email')).trim()+'\nService: '+service+'\n\n'+String(data.get('message')).trim()+'\n\nThank you.');
      const fallback=$('[data-enquiry-fallback]');fallback.href=target;fallback.hidden=false;
      $('[data-enquiry-status]').textContent='Your email app should open with the prepared enquiry. Send the message there to reach our team.';
    });
  }
  // The four service photographs share a single, keyboard-accessible carousel.
  // Only the first asset loads eagerly; later slides load when requested.
  const gallery=$('[data-hero-gallery]');
  if(gallery){
    const slides=[...gallery.querySelectorAll('[data-gallery-slide]')];
    const dots=[...gallery.querySelectorAll('[data-gallery-dot]')];
    const controls=gallery.querySelector('[data-gallery-controls]');
    const pauseButton=gallery.querySelector('[data-gallery-pause]');
    const counter=gallery.querySelector('[data-gallery-current]');
    const status=gallery.querySelector('[data-gallery-status]');
    let current=0,userPaused=false,hovered=false,galleryTimer;
    const forcedPause=()=>prefersReduced?.matches||document.body.classList.contains('is-motion-paused');
    function schedule(){
      clearTimeout(galleryTimer);
      const forced=forcedPause();
      pauseButton.hidden=Boolean(forced);
      pauseButton.setAttribute('aria-pressed',String(userPaused));
      pauseButton.setAttribute('aria-label',userPaused?'Resume slideshow':'Pause slideshow');
      pauseButton.querySelector('span').textContent=userPaused?'Play':'Pause';
      if(slides.length<2||forced||userPaused||hovered||document.hidden||gallery.contains(document.activeElement))return;
      galleryTimer=setTimeout(()=>{show(current+1,false);schedule();},7000);
    }
    function show(index,announce=true){
      current=(index+slides.length)%slides.length;
      const image=slides[current].querySelector('img');
      if(image.dataset.src){image.src=image.dataset.src;delete image.dataset.src;}
      slides.forEach((slide,i)=>{slide.hidden=i!==current;});
      dots.forEach((dot,i)=>dot.setAttribute('aria-pressed',String(i===current)));
      counter.textContent=String(current+1).padStart(2,'0');
      if(announce)status.textContent=slides[current].getAttribute('aria-label');
    }
    controls.hidden=false;
    gallery.querySelector('[data-gallery-next]').addEventListener('click',()=>{show(current+1);schedule();});
    gallery.querySelector('[data-gallery-prev]').addEventListener('click',()=>{show(current-1);schedule();});
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>{show(i);schedule();}));
    pauseButton.addEventListener('click',()=>{userPaused=!userPaused;schedule();});
    gallery.addEventListener('mouseenter',()=>{hovered=true;schedule();});
    gallery.addEventListener('mouseleave',()=>{hovered=false;schedule();});
    gallery.addEventListener('focusin',schedule);
    gallery.addEventListener('focusout',event=>{if(!gallery.contains(event.relatedTarget))queueMicrotask(schedule);});
    gallery.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();show(current+(event.key==='ArrowRight'?1:-1));schedule();
      }
    });
    document.addEventListener('visibilitychange',schedule);
    document.addEventListener('quiet-motion-change',schedule);
    prefersReduced?.addEventListener('change',schedule);
    show(0,false);schedule();
  }
})();
