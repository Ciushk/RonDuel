# Reglamento del juego RonDuel

**Última actualización: [DATA] (propuesta: 1 de diciembre de 2026)**
**Versión: 1.0**

En resumen: una ronda al día, la misma para todos, de aproximadamente un minuto. Las respuestas correctas suman puntos y las rápidas reciben bono. Todo se mide en nuestro servidor. Juegas con amigos en ligas y duelos. No se juega con dinero ni se gana dinero.

Este reglamento complementa los [Términos y condiciones](https://ronduel.eu/es/legal/terms). Si ambos textos se contradicen, prevalecen los Términos y condiciones.

El operador de RonDuel es Pixel-WebAPP SRL, CUI 54870881, N.º Reg. Mercantil J2026038031009, domicilio en [STRADA, NR.], Mangalia, provincia de Constanța, Rumanía, email contact@pixel-webapp.ro.

---

## 1. Qué es RonDuel y qué no es

1.1. RonDuel es un juego diario de cultura general y lógica para jugar con amigos. El resultado depende de tus conocimientos, razonamiento y velocidad.

1.2. **No es un juego de azar y no tiene premios.** No pagas ninguna apuesta para participar. No hay premios en dinero, objetos, vales ni otros beneficios. Los puntos, rachas, trofeos y clasificaciones no tienen valor monetario, no se pueden canjear por dinero ni transferir (art. 7 de los Términos).

1.3. **El juego base es gratuito.** Puedes jugar la ronda diaria, crear y unirte a ligas y jugar duelos sin pagar nada, dentro de los límites del art. 7.4. La suscripción RonDuel Pro es opcional y de pago (art. 12).

## 2. La ronda diaria

2.1. **Una ronda al día, la misma para todos.** Para cada fecha del calendario existe una única ronda. Todos los que comparten fecha reciben las mismas preguntas y opciones en el mismo orden. La ronda tiene un número (por ejemplo #142) que aumenta en 1 cada día desde el lanzamiento.

2.2. **Cuándo aparece la nueva ronda.** La nueva ronda aparece a **medianoche en tu hora local** (00:00 en la zona horaria de tu dispositivo). La fecha la calcula nuestro servidor según la hora del servidor y la zona horaria enviada por el dispositivo.

2.3. **Cambio de zona horaria.** La zona horaria guardada en tu cuenta puede cambiarse **como máximo una vez cada 24 horas** y cada cambio queda registrado.

2.4. **Qué contiene la ronda.** Por regla general, la ronda tiene **6 preguntas**:

- 2 preguntas de opción múltiple (1 correcta de 4);
- 1 pregunta de ordenar (colocar 4 elementos en el orden pedido);
- 1 pregunta de «el intruso» (elegir la opción que no encaja);
- 2 preguntas de lógica o cálculo (con 4 opciones).

2.5. **Tiempo por pregunta:**

- opción múltiple y «el intruso»: **10 segundos**;
- ordenar y lógica/cálculo: **15 segundos**.

Una ronda habitual dura unos 60 segundos, como máximo 75.

2.6. **Idioma de las preguntas.** Si una pregunta aún no tiene traducción verificada, se muestra en inglés con la etiqueta «EN».

## 3. Un solo intento al día

3.1. Puedes jugar la ronda diaria **una sola vez al día**, con una única cuenta.

3.2. **Cuándo empieza el intento.** Antes de empezar ves la pantalla «¿Listo?» y una cuenta atrás 3-2-1. **El intento comienza en el momento en que el servidor te envía la primera pregunta.**

3.3. **Si sales del juego.** Si cierras la página o pierdes la conexión, el intento no se reinicia. Al volver continúas con la siguiente pregunta sin responder, y la pregunta que dejaste cuenta como **expirada (0 puntos)**.

3.4. **Si no vuelves el mismo día.** [POR CONFIRMAR: la especificación no indica qué ocurre con una ronda iniciada y no terminada antes de medianoche. Propuesta: al final de tu día local la ronda se cierra automáticamente con 0 puntos en las preguntas pendientes.]

## 4. Cómo se calculan los puntos

4.1. **Respuesta correcta: 100 puntos + bono de velocidad.**
**Respuesta incorrecta o tiempo agotado: 0 puntos.**

4.2. **Fórmula del bono de velocidad:**

> bonus = round( 100 × max(0, (límite − tiempo) / límite) )

donde:

- **límite** = tiempo de la pregunta (10 o 15 segundos);
- **tiempo** = tiempo medido **en nuestro servidor**, desde el envío de la pregunta hasta la recepción de tu respuesta, **menos 250 milisegundos** de margen de red (mínimo 0);
- **round** = redondeo al entero más cercano.

Una respuesta correcta recibe entre 100 y 200 puntos.

4.3. **Ejemplos** (pregunta de 10 segundos, respuesta correcta):

- respuesta recibida tras 2,25 s: tiempo = 2 s, bono = round(100 × 8/10) = 80, total **180**;
- respuesta recibida tras 7,75 s: tiempo = 7,5 s, bono = round(100 × 2,5/10) = 25, total **125**;
- respuesta tras agotar el tiempo: **0 puntos**. [POR CONFIRMAR: si la tolerancia de 250 ms se aplica también al límite de expiración.]

4.4. **Puntuación máxima: 1.200 puntos al día** (6 preguntas × 200).

4.5. **Las preguntas de ordenar** puntúan «todo o nada»: solo recibes puntos si los 4 elementos están en el orden exacto.

4.6. **El temporizador en pantalla es solo informativo.** Solo cuenta el tiempo medido por el servidor.

4.7. **Tiempo extendido (accesibilidad).** En Ajustes puedes activar «Temporizador relajado», que da un **50% más de tiempo** en cada pregunta. [POR CONFIRMAR: si el bono de velocidad se calcula sobre el límite estándar o el límite ampliado.]

## 5. Empates

5.1. **Clasificación del día.** En caso de empate a puntos, gana quien tenga el **menor tiempo total** medido por el servidor. Si persiste el empate, gana quien haya **terminado la ronda antes**.

5.2. **Clasificación semanal y trofeo.** A igualdad de puntos semanales, gana quien tenga **menos segundos en total**. [POR CONFIRMAR: qué ocurre si también hay empate en el tiempo total. Propuesta: se otorga el trofeo a todos los empatados.]

5.3. **Duelos.** Ver art. 8.4.

## 6. Clasificaciones

6.1. Cada liga tiene tres clasificaciones:

- **Hoy**: puntuaciones de la ronda del día;
- **Esta semana**: suma de puntuaciones diarias de la semana de la liga (los días no jugados cuentan 0);
- **Histórico**: puntuación total, rondas jugadas, trofeos semanales y mejor racha.

6.2. **Sin spoilers.** Hasta que no termines la ronda de hoy, no ves las puntuaciones de hoy de los demás.

6.3. **Día y semana de la liga.** Se calculan según la **zona horaria de la liga** (de lunes 00:00 a domingo 23:59:59).

6.4. [POR CONFIRMAR: asignación de fecha cuando los miembros tienen distintas zonas horarias y efecto del cambio de zona horaria de la liga a mitad de semana.]

6.5. Solo la ronda diaria cuenta en las clasificaciones. Las rondas de archivo y extra **no cuentan** (art. 12.3).

## 7. Ligas

7.1. **Creación de una liga.** Tras tu primera ronda, al compartir tu resultado se crea automáticamente una liga con nombre generado y código de invitación de 6 caracteres.

7.2. **Unirse a una liga.** Quien abre el enlace ve el nombre de la liga y miembros y puede entrar eligiendo un apodo único en esa liga.

7.3. **Entrada durante la semana.** Puedes unirte en cualquier momento; los días previos cuentan como 0 en la semana.

7.4. **Límites de la cuenta gratuita:**

- crear hasta **1 liga**, con hasta **5 miembros** (tú incluido);
- ser miembro de hasta **10 ligas**;
- tener como máximo **4 duelos por mes** (y 1 duelo activo al mismo tiempo).

7.5. **El propietario de la liga** puede cambiar el nombre y zona horaria de la liga, cambiar el apodo o eliminar a un miembro y transferir la propiedad.

7.6. **Salir de la liga.** Puedes salir en cualquier momento. [POR CONFIRMAR: tratamiento de puntuaciones tras salir y transferencia automática si el propietario elimina su cuenta.]

7.7. **Eliminación de cuenta.** Si un miembro elimina su cuenta, sus puntuaciones permanecen bajo el nombre «Antiguo jugador» (art. 5.6 de los Términos).

## 8. Duelos 1 contra 1

8.1. **Qué es un duelo.** Una minirronda separada de **5 preguntas** entre dos jugadores, excluyendo las preguntas de hoy y de los próximos 7 días.

8.2. **Quién puede jugar.** Puedes retar a un miembro de tu liga o enviar un enlace abierto a cualquiera.

8.3. **Puntuación.** Igual que la ronda diaria (art. 4), hasta un máximo de 1.000 puntos. [POR CONFIRMAR: confirmación expresa de fórmula idéntica.]

8.4. **Quién gana.** Gana la mayor puntuación y, en caso de empate, el **menor tiempo total**. [POR CONFIRMAR: empate total de puntos y tiempo.]

8.5. **Plazos y expiración:**

- cada jugador tiene **24 horas** para jugar su parte;
- si el rival no empieza en 24 horas desde la creación, el duelo **expira** sin ganador;
- si el retador terminó su parte y el rival no juega en 24 horas desde entonces, gana el retador **por incomparecencia**.

[POR CONFIRMAR: intento de duelo incompleto y asignación de rival en enlace abierto.]

8.6. **Dónde aparecen los resultados.** En la página del duelo y en la actividad de la liga. **Los duelos no suman puntos en las clasificaciones de la liga.**

## 9. Rachas (streak)

9.1. La racha aumenta en 1 por cada día local consecutivo en el que **hayas terminado** la ronda diaria.

9.2. **Escudo de racha (solo Pro).** Los suscriptores Pro tienen automáticamente 1 escudo por semana ISO (lunes a domingo) que cubre un día sin jugar. [POR CONFIRMAR: cálculo de la semana ISO según la zona horaria del jugador.]

## 10. Juego limpio y trampas

10.1. **Qué se considera trampa:**

- usar scripts, bots o herramientas automatizadas;
- usar múltiples cuentas para repetir la ronda o inflar una liga;
- manipular la zona horaria, el reloj o las peticiones al servidor;
- interceptar o modificar datos de la aplicación para ver respuestas;
- publicar las preguntas o respuestas del día antes de que termine la jornada. [POR CONFIRMAR: adopción de esta regla.]

10.2. **Cómo lo detectamos.** Marcamos para revisión humana sin bloqueo automático:

- rondas con **al menos 3 respuestas** en menos de **0,4 segundos**;
- múltiples cuentas desde el mismo dispositivo o IP en la misma liga el mismo día.

10.3. **Sanciones:**

- **anulación de la puntuación** de una ronda o duelo y recálculo de clasificaciones;
- restricción temporal de funciones;
- **suspensión o cierre de la cuenta** en casos graves o repetidos.

[POR CONFIRMAR: retirada y reasignación de un trofeo semanal en un plazo de 7 días tras anular una puntuación.]

10.4. **Explicación y reclamación.** Puedes reclamar según los **art. 9 y art. 13 de los Términos y condiciones** (https://ronduel.eu/es/legal/terms).

## 11. Errores en preguntas y problemas técnicos

11.1. **Pregunta errónea.** Si encuentras una pregunta con error o ambigua, escríbenos a contact@pixel-webapp.ro.

11.2. **Qué hacemos con los puntos.** [POR CONFIRMAR: propuesta de otorgar 100 puntos + bono normal a quienes respondieron a tiempo una pregunta errónea.]

11.3. **Problemas técnicos tuyos.** Los fallos de conexión o dispositivo no dan derecho a un nuevo intento (art. 3.3).

11.4. **Problemas técnicos nuestros.** [POR CONFIRMAR: propuesta de anulación o repetición en caso de caída del servidor sin pérdida de racha.]

11.5. Si no estás de acuerdo con una decisión bajo este artículo, escríbenos a contact@pixel-webapp.ro.

## 12. Qué incluye RonDuel Pro

12.1. Pro es una suscripción de pago opcional regulada en los [Términos Pro](https://ronduel.eu/es/legal/terms). Pro incluye:

- ligas de hasta **200 miembros**, ligas privadas con aprobación y emoji/color propio;
- **duelos ilimitados**;
- **archivo** de rondas pasadas;
- **rondas extra** de práctica;
- **estadísticas avanzadas** por tema;
- **temas** visuales;
- **escudo de racha** semanal (art. 9.2).

12.2. **Pro no da puntos extra.** Los suscriptores Pro juegan la ronda diaria en las mismas condiciones que todos.

12.3. **Las rondas de archivo y extra** son solo para práctica y **no cuentan** en clasificaciones, trofeos ni racha. [POR CONFIRMAR: aplicación explícita a las rondas extra.]

12.4. El escudo de racha puede influir en la racha mostrada y los duelos ilimitados en el balance de duelos, sin afectar a los puntos de las clasificaciones.

## 13. Modificación del reglamento

13.1. Podemos modificar este reglamento anunciando cambios importantes en la aplicación con al menos **7 días** de antelación, aplicándose al inicio de la siguiente semana de juego. [POR CONFIRMAR: plazo de 7 días frente a los 30 días de los Términos.]

13.2. La fecha de última actualización figura al principio y al final de la página.

## 14. Contacto

Preguntas sobre las reglas: contact@pixel-webapp.ro.

---

_Última actualización: [DATA] (propuesta: 1 de diciembre de 2026)_
