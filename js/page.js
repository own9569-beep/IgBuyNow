const $=id=>document.getElementById(id),modal=$('modal');
$('close').onclick=()=>modal.classList.remove('show');
modal.onclick=e=>{if(e.target===modal)modal.classList.remove('show')};
document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('show')});
$('categoryToggle').onclick=()=>{const menu=$('categoryMenu');menu.hidden=!menu.hidden;$('categoryToggle').setAttribute('aria-expanded',String(!menu.hidden))};
$('navSupport').onclick=e=>{e.preventDefault();$('supportLaunch')?.click()};
