# Regulamento do jogo RonDuel

**Última atualização: [DATA] (proposta: 1 de dezembro de 2026)**
**Versão: 1.0**

Em resumo: uma rodada por dia, a mesma para todos, de cerca de um minuto. Respostas corretas ganham pontos e respostas rápidas ganham bônus. Tudo é medido em nosso servidor. Você joga com amigos em ligas e duelos. Não há apostas em dinheiro nem prêmios em dinheiro.

Este regulamento complementa os [Termos e Condições](https://ronduel.eu/pt/legal/terms). Se os dois textos entrarem em conflito, aplicam-se os Termos e Condições.

A operadora do RonDuel é Pixel-WebAPP SRL, CUI 54870881, N.º Reg. Comercial J2026038031009, sede em [STRADA, NR.], Mangalia, distrito de Constanța, Romênia, email contact@pixel-webapp.ro.

---

## 1. O que é o RonDuel e o que não é

1.1. O RonDuel é um jogo diário de conhecimentos gerais e lógica jogado com amigos. O resultado depende do seu conhecimento, raciocínio e velocidade.

1.2. **Não é um jogo de azar e não tem prêmios.** Você não paga nenhuma aposta para participar. Não existem prêmios em dinheiro, objetos, vales ou outras vantagens. Pontos, sequências, troféus e rankings não têm valor monetário, não podem ser trocados por dinheiro nem transferidos (art. 7 dos Termos).

1.3. **O jogo base é gratuito.** Você pode jogar a rodada diária, criar e entrar em ligas e jogar duelos sem pagar nada, dentro dos limites do art. 7.4. A assinatura RonDuel Pro é opcional e paga (art. 12).

## 2. A rodada diária

2.1. **Uma rodada por dia, a mesma para todos.** Para cada data do calendário existe uma única rodada. Todos na mesma data recebem as mesmas perguntas e alternativas na mesma ordem. A rodada tem um número (por exemplo #142) que aumenta em 1 a cada dia desde o lançamento.

2.2. **Quando sai a nova rodada.** A nova rodada abre à **meia-noite no seu horário local** (00:00 no fuso horário do seu dispositivo). A data é calculada pelo nosso servidor com base na hora do servidor e no fuso horário enviado pelo dispositivo.

2.3. **Mudança de fuso horário.** O fuso horário salvo na sua conta pode ser alterado **no máximo uma vez a cada 24 horas** e cada alteração é registrada.

2.4. **O que contém a rodada.** Normalmente, a rodada tem **6 perguntas**:

- 2 perguntas de múltipla escolha (1 correta entre 4);
- 1 pergunta de ordenação (organizar 4 itens na ordem pedida);
- 1 pergunta «o intruso» (escolher a opção que não combina);
- 2 perguntas de lógica ou cálculo (com 4 opções).

2.5. **Tempo por pergunta:**

- múltipla escolha e «o intruso»: **10 segundos**;
- ordenação e lógica/cálculo: **15 segundos**.

Uma rodada normal dura cerca de 60 segundos, no máximo 75.

2.6. **Idioma das perguntas.** Se uma pergunta ainda não tiver tradução verificada, você a recebe em inglês com o selo «EN».

## 3. Uma única tentativa por dia

3.1. Você pode jogar a rodada diária **apenas uma vez por dia**, com uma única conta.

3.2. **Quando começa a tentativa.** Antes do início você vê a tela «Pronto?» e a contagem 3-2-1. **A tentativa começa no momento em que o servidor envia a primeira pergunta.**

3.3. **Se você sair do jogo.** Se fechar a página ou perder a conexão, a tentativa não reinicia. Ao voltar você continua na próxima pergunta não respondida, e a pergunta deixada conta como **tempo esgotado (0 pontos)**.

3.4. **Se não voltar no mesmo dia.** [A CONFIRMAR: a especificação não define o que acontece com uma rodada iniciada e não concluída até a meia-noite. Proposta: ao final do seu dia local a rodada fecha automaticamente com 0 pontos nas perguntas sem resposta.]

## 4. Como os pontos são calculados

4.1. **Resposta correta: 100 pontos + bônus de velocidade.**
**Resposta errada ou tempo esgotado: 0 pontos.**

4.2. **Fórmula do bônus de velocidade:**

> bonus = round( 100 × max(0, (limite − tempo) / limite) )

onde:

- **limite** = tempo da pergunta (10 ou 15 segundos);
- **tempo** = tempo medido **em nosso servidor**, desde o envio da pergunta até a chegada da sua resposta, **menos 250 milissegundos** de tolerância de rede (mínimo 0);
- **round** = arredondamento para o inteiro mais próximo.

Uma resposta correta recebe entre 100 e 200 pontos.

4.3. **Exemplos** (pergunta de 10 segundos, resposta correta):

- resposta recebida após 2,25 s: tempo = 2 s, bônus = round(100 × 8/10) = 80, total **180**;
- resposta recebida após 7,75 s: tempo = 7,5 s, bônus = round(100 × 2,5/10) = 25, total **125**;
- resposta após o tempo expirar: **0 pontos**. [A CONFIRMAR: se a tolerância de 250 ms também se aplica ao limite de expiração.]

4.4. **Pontuação máxima: 1.200 pontos por dia** (6 perguntas × 200).

4.5. **Perguntas de ordenação** valem «tudo ou nada»: você só ganha pontos se todos os 4 itens estiverem na ordem correta.

4.6. **O cronômetro na tela é apenas informativo.** Para os pontos vale exclusivamente o tempo medido pelo servidor.

4.7. **Tempo estendido (acessibilidade).** Nos Ajustes você pode ativar «Tempo relaxado», que dá **50% mais tempo** em cada pergunta. [A CONFIRMAR: se o bônus de velocidade é calculado pelo limite padrão ou pelo limite ampliado.]

## 5. Empates

5.1. **Ranking do dia.** Em caso de empate na pontuação, vence quem tiver o **menor tempo total** medido pelo servidor. Persistindo o empate, vence quem **terminou a rodada mais cedo**.

5.2. **Ranking da semana e troféu.** Em empate semanal, vence quem tiver **menos segundos no total** na semana. [A CONFIRMAR: o que acontece se o tempo total também empatar. Proposta: o troféu é concedido a todos os empatados.]

5.3. **Duelos.** Veja o art. 8.4.

## 6. Rankings

6.1. Cada liga tem três rankings:

- **Hoje**: pontuações da rodada do dia;
- **Esta semana**: soma das pontuações diárias na semana da liga (dias não jogados valem 0);
- **Geral**: pontuação total, rodadas jogadas, troféus semanais e maior sequência.

6.2. **Sem spoilers.** Até terminar a rodada de hoje, você não vê as pontuações de hoje dos outros membros.

6.3. **Dia e semana da liga.** Calculados pelo **fuso horário da liga** (segunda-feira 00:00 até domingo 23:59:59).

6.4. [A CONFIRMAR: atribuição de dia quando membros estão em fusos diferentes e efeito da mudança de fuso da liga no meio da semana.]

6.5. Apenas a rodada diária entra nos rankings. Rodadas do arquivo e rodadas extras **não contam** (art. 12.3).

## 7. Ligas

7.1. **Criação de uma liga.** Após a primeira rodada, compartilhar o resultado no grupo cria automaticamente uma liga com nome gerado e código de convite de 6 caracteres.

7.2. **Entrada na liga.** Quem abre o link vê o nome da liga e membros e pode entrar escolhendo um apelido único naquela liga.

7.3. **Entrada durante a semana.** Você pode entrar a qualquer momento; os dias anteriores contam como 0 no ranking semanal.

7.4. **Limites da conta gratuita:**

- criar até **1 liga**, com até **5 membros** (você incluído);
- ser membro de até **10 ligas**;
- ter no máximo **4 duelos por mês** (e 1 duelo ativo ao mesmo tempo).

7.5. **O proprietário da liga** pode alterar o nome e fuso horário da liga, alterar o apelido ou remover um membro e transferir a propriedade.

7.6. **Saída da liga.** Você pode sair a qualquer momento. [A CONFIRMAR: tratamento das pontuações após a saída e transferência automática se o proprietário excluir a conta.]

7.7. **Exclusão de conta.** Se um membro excluir sua conta, suas pontuações permanecem nos rankings como «Ex-jogador» (art. 5.6 dos Termos).

## 8. Duelos 1 contra 1

8.1. **O que é um duelo.** Uma minirrodada separada de **5 perguntas** entre dois jogadores, excluindo as perguntas de hoje e dos próximos 7 dias.

8.2. **Quem pode jogar.** Você pode desafiar um membro da sua liga ou enviar um link aberto para qualquer pessoa.

8.3. **Pontuação.** Igual à rodada diária (art. 4), com pontuação máxima de 1.000 pontos. [A CONFIRMAR: confirmação explícita da mesma fórmula.]

8.4. **Quem vence.** Vence a maior pontuação e, em caso de empate, o **menor tempo total**. [A CONFIRMAR: empate total de pontos e tempo.]

8.5. **Prazos e expiração:**

- cada jogador tem **24 horas** para jogar sua parte;
- se o oponente não começar em 24 horas após a criação, o duelo **expira** sem vencedor;
- se quem desafiou terminou sua parte e o oponente não jogar em 24 horas a partir daí, vence quem desafiou **por W.O. (ausência do oponente)**.

[A CONFIRMAR: tentativa incompleta no duelo e definição do oponente em link aberto.]

8.6. **Onde aparecem os resultados.** Na página do duelo e no feed da liga. **Os duelos não somam pontos nos rankings da liga.**

## 9. Sequências (streak)

9.1. A sequência aumenta em 1 a cada dia local consecutivo em que você **terminar** a rodada do dia.

9.2. **Escudo de sequência (apenas Pro).** Assinantes Pro têm automaticamente 1 escudo por semana ISO (segunda a domingo) que cobre um dia perdido. [A CONFIRMAR: cálculo da semana ISO pelo fuso horário do jogador.]

## 10. Jogo limpo e trapaça

10.1. **O que significa trapaça:**

- usar scripts, bots ou ferramentas automatizadas;
- usar várias contas para repetir a mesma rodada ou inflar uma liga;
- manipular fuso horário, relógio ou requisições ao servidor;
- interceptar ou modificar dados do aplicativo para ver respostas antes;
- publicar perguntas ou respostas do dia antes do fim do dia. [A CONFIRMAR: adoção desta regra.]

10.2. **Como detectamos.** Marcamos para verificação humana sem bloqueio automático:

- rodadas com **pelo menos 3 respostas** em menos de **0,4 segundos**;
- várias contas do mesmo dispositivo ou IP na mesma liga no mesmo dia.

10.3. **Sanções:**

- **anulação da pontuação** de uma rodada ou duelo e recálculo dos rankings;
- restrição temporária de funções;
- **suspensão ou encerramento da conta** em casos graves ou repetidos.

[A CONFIRMAR: revogação e nova entrega de troféu semanal em até 7 dias após anulação de pontuação.]

10.4. **Explicação e contestação.** Você pode contestar conforme os **art. 9 e art. 13 dos Termos e Condições** (https://ronduel.eu/pt/legal/terms).

## 11. Erros em perguntas e problemas técnicos

11.1. **Pergunta incorreta.** Se encontrar uma pergunta errada ou ambígua, escreva para contact@pixel-webapp.ro.

11.2. **O que fazemos com os pontos.** [A CONFIRMAR: proposta de conceder 100 pontos + bônus normal a todos que responderam dentro do tempo.]

11.3. **Seus problemas técnicos.** Problemas de conexão ou dispositivo não dão direito a nova tentativa (art. 3.3).

11.4. **Nossos problemas técnicos.** [A CONFIRMAR: proposta de anulação ou repetição em caso de falha do servidor sem perda de sequência.]

11.5. Se discordar de uma decisão sob este artigo, escreva para contact@pixel-webapp.ro.

## 12. O que você recebe com o RonDuel Pro

12.1. O Pro é uma assinatura paga opcional regida pelos [Termos Pro](https://ronduel.eu/pt/legal/terms). O Pro inclui:

- ligas de até **200 membros**, ligas privadas com aprovação e emoji/cor própria;
- **duelos ilimitados**;
- **arquivo** de rodadas passadas;
- **rodadas extras** de treino;
- **estatísticas avançadas** por tema;
- **temas** visuais;
- **escudo de sequência** semanal (art. 9.2).

12.2. **O Pro não dá pontos extras.** Assinantes Pro jogam a rodada diária nas mesmas condições que todos.

12.3. **Rodadas do arquivo e rodadas extras** são apenas para treino e **não contam** nos rankings, troféus ou sequência. [A CONFIRMAR: extensão explícita para rodadas extras.]

12.4. O escudo de sequência pode influenciar a sequência exibida e os duelos ilimitados o histórico de duelos, sem afetar os pontos dos rankings.

## 13. Alteração do regulamento

13.1. Podemos alterar este regulamento anunciando mudanças importantes no aplicativo com pelo menos **7 dias** de antecedência, valendo a partir do início da semana de jogo seguinte. [A CONFIRMAR: prazo de 7 dias frente aos 30 dias dos Termos.]

13.2. A data da última atualização consta no início e no fim da página.

## 14. Contato

Dúvidas sobre as regras: contact@pixel-webapp.ro.

---

_Última atualização: [DATA] (proposta: 1 de dezembro de 2026)_
