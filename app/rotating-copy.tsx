'use client';
import { useEffect, useRef, useState } from 'react';

const copy={
  es:[
    ['Menos «luego».','Más hecho.','La cama no se hace sola. Los Xp tampoco. Tú mandas en tu siguiente movimiento.'],
    ['Tu yo de mañana','te debe una.','Hazlo ahora y deja a tu futuro yo sin excusas. Qué detalle.'],
    ['Misión pequeña.','Xp muy reales.','Nadie compone una banda sonora épica para recoger la ropa. Nosotros casi.'],
    ['Primero la misión.','Luego el premio.','El sofá seguirá ahí cuando termines. Tiene una paciencia legendaria.'],
    ['Cero perfección.','Mucho avance.','Hazlo suficientemente bien. La perfección no da Xp extra.'],
    ['La misión no muerde.','La excusa, sí.','Cinco minutos de acción ganan a una tarde negociando con el universo.'],
    ['No es magia.','Es empezar.','El primer movimiento es pequeño. El efecto bola de nieve, bastante menos.'],
    ['Un calcetín menos.','Un caos menos.','Cada cosa en su sitio. El suelo no es un armario con vocación de basurero.'],
    ['Hazlo antes','de pensarlo demasiado.','Tu cerebro abrirá una pestaña de excusas. Ciérrala con una misión hecha.'],
    ['Xp por esfuerzo.','No por ser perfecta.','Equivocarse entra en el pack. Volver a intentarlo también suma.'],
    ['Tu habitación','no es un boss final.','Empieza por una esquina. El dragón de la ropa pierde poder muy rápido.'],
    ['Hoy toca','modo capaz.','No hace falta una capa. Aunque para doblar camisetas quizá ayudaría.'],
    ['La mochila lista.','El mañana respira.','Tu yo de las ocho de la mañana te mandaría flores. O tostadas.'],
    ['Cero drama.','Una misión.','Elige una. Hazla. Luego ya veremos si el mundo sigue girando. Spoiler: sí.'],
    ['No esperes','ganas míticas.','Las ganas llegan tarde y sin avisar. El movimiento puede empezar sin ellas.'],
    ['Primero orden.','Luego conquista.','Un escritorio despejado tiene menos monstruos y más espacio para ideas.'],
    ['Tu plan','tiene piernas.','Apúntalo, empieza y mira cómo deja de ser una idea decorativa.'],
    ['Pequeño paso.','Combo activo.','Una misión abre la puerta de la siguiente. Como las patatas, pero útil.'],
    ['La ropa limpia','quiere hogar.','No la abandones en la silla. Ya tiene suficiente con su crisis de identidad.'],
    ['Hazlo a tu ritmo.','Hazlo de verdad.','No hay cronómetro de película. Solo el siguiente movimiento.'],
    ['Misión cumplida.','Cerebro tranquilo.','El descanso sabe bastante mejor cuando no hay una montaña mirándote.'],
    ['Una cosa hecha','vale por tres “luegos”.','Las promesas al futuro son bonitas. Las acciones, bastante más prácticas.'],
    ['No eres un robot.','Por suerte.','Pausa si toca. Vuelve cuando puedas. El progreso no desaparece por respirar.'],
    ['La cama hecha.','El día desbloqueado.','No arregla el planeta, pero empezar con una victoria tiene su gracia.'],
    ['Busca el siguiente','movimiento fácil.','No hace falta resolver tu vida. Con recoger esa camiseta ya vas ganando.'],
    ['Plan corto.','Victoria larga.','Lo que haces cinco minutos hoy le ahorra treinta minutos al caos de mañana.'],
    ['Ducha lista.','Modo humano activado.','El champú no cuenta como decoración. Úsalo con intención, agente.'],
    ['Ayudar no es','ser el extra.','La casa es de todos. La mesa tampoco se pone con telequinesis. Aún.'],
    ['No hay misión','demasiado pequeña.','Solo misiones que se quedan mirando hasta que alguien empieza.'],
    ['Tu futuro yo','tiene buena memoria.','Y recuerda perfectamente quién dejó la mochila para el último minuto.'],
    ['Una pausa','no rompe la racha.','Descansar también es una estrategia. Los robots se recalientan por algo.'],
    ['Haz la parte','que sí controlas.','No puedes controlar el universo. La ropa del suelo, sorprendentemente, sí.'],
    ['Suma intentos.','No excusas.','Hay días raros. Haz lo posible y deja el teatro para la serie.'],
    ['El orden empieza','con una cosa.','Una cosa colocada. Luego otra. El caos no tiene abogado.'],
    ['No hace falta épica.','Hace falta hecho.','Nadie pide fanfarria. Con que la misión deje de estar pendiente, suficiente.'],
    ['Cambia “qué pereza”','por “dos minutos”.','A veces el truco más potente es engañar al cerebro con una misión pequeña.'],
    ['Tu casa es base.','Cuídala.','No es un hotel. Aunque el servicio de habitaciones sigue siendo sospechosamente bueno.'],
    ['La lista existe','para liberarte.','Mirarla no hace las misiones. Pero evita que vivan rent free en tu cabeza.'],
    ['Primero acción.','Luego pantalla.','La recompensa llega mejor cuando no viene acompañada de culpa y migas.'],
    ['Misión de hoy.','Xp de verdad.','No hay puntos por prometer. Hay puntos por mover ficha.'],
    ['Una habitación','no se ordena sola.','Qué escándalo. Tendrá que intervenir alguien con manos y criterio.'],
    ['El progreso','no hace ruido.','A veces es solo una cama, una mochila y una versión tuya algo más libre.'],
    ['Haz una cosa','que te ayude luego.','Es la clase de favor que el tiempo casi nunca rechaza.'],
    ['Constancia rara.','Resultado real.','No tiene que salir perfecto. Tiene que pasar más veces que nunca.'],
    ['La misión espera.','Tú decides.','Puedes hacerla ahora o dejar que gane otra ronda. No parece muy lista.'],
    ['Hazlo sencillo.','Hazlo tuyo.','Cuando una misión tiene tu forma, dura más que una norma gritada.'],
    ['El siguiente Xp','está muy cerca.','Probablemente debajo de una sudadera. Investiga con cuidado.'],
    ['Cinco minutos.','Cero excusas premium.','Empieza antes de que tu cerebro monte una rueda de prensa.'],
    ['Bien hecho','no significa impecable.','Significa que lo intentaste con intención. Eso sí cambia el día.'],
    ['No esperes al lunes.','Empieza en pequeño.','El lunes tiene demasiada publicidad. Hoy funciona bastante bien.'],
  ],
  ca:[
    ['Menys «després».','Més fet.','El llit no es fa sol. Els Xp tampoc. Tu tries el següent moviment.'],
    ['El teu jo de demà','et deu una.','Fes-ho ara i deixa el teu futur jo sense excuses. Quin detall.'],
    ['Missió petita.','Xp ben reals.','Ningú posa música èpica per recollir la roba. Nosaltres gairebé.'],
  ],
  en:[
    ['Less “later”.','More done.','The bed will not make itself. Neither will the Xp. Your move.'],
    ['Tomorrow you','owes you one.','Do it now and leave your future self with no excuses. Nice.'],
    ['Small mission.','Very real Xp.','Nobody writes epic music for laundry. We almost did.'],
  ],
};
export function RotatingCopy({lang,onAdvance}:{lang:'es'|'ca'|'en';onAdvance?:()=>void}){
  const [index,setIndex]=useState(0),last=useRef(-1),items=copy[lang],active=index%items.length;
  useEffect(()=>{const next=()=>setIndex(current=>{let candidate=current;while(candidate===current||candidate===last.current)candidate=Math.floor(Math.random()*items.length);last.current=current;return candidate;});next();const timer=setInterval(next,8500);return()=>clearInterval(timer);},[items.length,lang]);
  const item=items[active];
  return <div className="rotating-copy" key={`${lang}-${active}`}><h1>{item[0]}<br/><em>{item[1]}</em></h1><p>{item[2]}</p><button className="copy-progress" onClick={()=>{onAdvance?.();setIndex((active+1)%items.length);}} aria-label="Cambiar frase">{active+1} / {items.length}</button></div>
}
