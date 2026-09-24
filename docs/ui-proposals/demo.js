const root=document.querySelector('.demo');
const childButtons=[...document.querySelectorAll('[data-switch]')];
const tasks={
  aina:[['🛏','Hacer mi cama','1 XP'],['✨','Mi habitación, en orden','5 XP'],['🪥','Lavar los dientes','2 XP · 2 veces'],['🍽','Recoger la mesa de la cena','2 XP'],['🎒','Mochila extraescolar','5 XP']],
  iara:[['🛏','Hacer mi cama','1 XP'],['✨','Mi habitación, en orden','5 XP'],['🪥','Lavar los dientes','2 XP · 2 veces'],['🍽','Preparar la mesa para cenar','2 XP'],['🎒','Mochila extraescolar','5 XP']]
};
const done={aina:new Set(),iara:new Set()};
let child='aina';
function render(){
  root.dataset.child=child;
  childButtons.forEach(button=>button.classList.toggle('active',button.dataset.switch===child));
  document.querySelectorAll('[data-child-name]').forEach(el=>el.textContent=child==='aina'?'Aina':'Iara');
  document.querySelectorAll('[data-tasks]').forEach(container=>{container.innerHTML=tasks[child].map(([icon,name,xp],i)=>`<button class="demo-task ${done[child].has(i)?'done':''}" data-task="${i}"><span>${done[child].has(i)?'✓':icon}</span><strong>${name}<small>${done[child].has(i)?'Completada':'Toca para completar'}</small></strong><b>+${xp}</b></button>`).join('');});
  document.querySelectorAll('[data-count]').forEach(el=>el.textContent=String(done[child].size));
  document.querySelectorAll('[data-progress]').forEach(el=>el.style.width=`${done[child].size*20}%`);
  document.querySelectorAll('[data-xp]').forEach(el=>el.textContent=String(384+done[child].size*5));
}
function celebrate(){
  const confetti=document.querySelector('.demo-confetti');confetti.innerHTML='';
  for(let i=0;i<42;i++){const bit=document.createElement('i');bit.style.setProperty('--angle',`${(i*137.5)%360}deg`);bit.style.animationDelay=`${(i%8)*65}ms`;confetti.append(bit);}
  document.querySelector('.demo-overlay').hidden=false;
}
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.switch){child=button.dataset.switch;render();}
  if(button.dataset.task!==undefined){const id=Number(button.dataset.task);done[child].has(id)?done[child].delete(id):done[child].add(id);render();if(done[child].size===tasks[child].length)celebrate();}
  if(button.dataset.celebrate!==undefined)celebrate();
  if(button.dataset.closeCelebration!==undefined)document.querySelector('.demo-overlay').hidden=true;
  if(button.dataset.rules!==undefined)document.querySelector('.demo-rules').hidden=false;
  if(button.dataset.closeRules!==undefined)document.querySelector('.demo-rules').hidden=true;
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){document.querySelector('.demo-overlay').hidden=true;document.querySelector('.demo-rules').hidden=true;}});
render();
