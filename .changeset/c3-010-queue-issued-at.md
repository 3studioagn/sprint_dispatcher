---
'sprint-operator-agent': minor
---

feat(C3): fila de avisos pendentes em ordem cronológica [BL-C3-010]

QueueService.enqueue agora insere por ordem ascendente de payload.criado_em
(timestamp ISO-8601 de emissão pelo Leader), substituindo o FIFO simples
anterior — alinhando com RF-16 e UC-02 A4. Múltiplos pendentes para a mesma
estação são exibidos na ordem real de criação, não na ordem em que o filesystem
SMB entregou.

Cenário típico: sprint A criada às 10:00 falha por rede e é re-gravada às 10:10.
Sprint B criada às 10:05 chega íntegra antes de A. Sem ordenação, B seria
exibida primeiro; com BL-C3-010, A volta a vir primeiro.

Comparação via Date.parse — timezone-aware. Empate em criado_em mantém ordem de
chegada (FIFO no empate). Invariante crítica: items[0] (sprint atualmente
exibida) NÃO é preempted — sprints novas com criado_em mais antigo entram em
items[1].
