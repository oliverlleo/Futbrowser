UPDATE private.career_event_templates t
SET choices=(SELECT jsonb_agg(CASE WHEN e->>'key'='pair' THEN jsonb_set(e,'{effects,rivalry}','-1'::jsonb,true) ELSE e END ORDER BY ord) FROM jsonb_array_elements(t.choices) WITH ORDINALITY x(e,ord))
WHERE event_key='mate_rival_challenge';

UPDATE private.career_event_templates t
SET choices=(SELECT jsonb_agg(CASE WHEN e->>'key'='technical' THEN jsonb_set(e,'{effects,rivalry}','-1'::jsonb,true) ELSE e END ORDER BY ord) FROM jsonb_array_elements(t.choices) WITH ORDINALITY x(e,ord))
WHERE event_key='mate_rival_contact';

UPDATE private.career_event_templates t
SET choices=(SELECT jsonb_agg(CASE WHEN e->>'key'='return_respect' THEN jsonb_set(e,'{effects,rivalry}','-1'::jsonb,true) ELSE e END ORDER BY ord) FROM jsonb_array_elements(t.choices) WITH ORDINALITY x(e,ord))
WHERE event_key='mate_rival_respect';

UPDATE private.career_event_templates t
SET choices=(SELECT jsonb_agg(CASE WHEN e->>'key'='ignore_rank' THEN jsonb_set(e,'{effects,rivalry}','-1'::jsonb,true) ELSE e END ORDER BY ord) FROM jsonb_array_elements(t.choices) WITH ORDINALITY x(e,ord))
WHERE event_key='mate_rival_media';

UPDATE private.career_event_templates
SET title='A disputa fica mais direta',
    body='Depois de um lance mais forte no treino, o jogador que compete com você pela posição pergunta até onde você pretende levar essa disputa.',
    choices='[{"key":"intensity","label":"Dizer que pretende manter a intensidade e espera a mesma resposta dele.","reply":"Então estamos entendidos. Nada vai vir de graça.","result":"A rivalidade ficou mais explícita e competitiva.","reply_speaker":"Rival","effects":{"ambition":2,"pressure":1,"rivalry":1,"teammate_relation":-2}},{"key":"technical","label":"Voltar ao lance e discutir onde cada um chegou antes ou depois na disputa.","reply":"Vendo o lance assim, dá para separar disputa de provocação.","result":"A tensão foi convertida em leitura técnica.","reply_speaker":"Rival","effects":{"teammate_relation":3,"rivalry":-1,"leadership":1}},{"key":"boundary","label":"Dizer que aceita a concorrência, mas não quer que ela mude o funcionamento do time.","reply":"Concordo. A vaga é uma coisa; atrapalhar o grupo é outra.","result":"Vocês colocaram um limite profissional na rivalidade.","reply_speaker":"Rival","effects":{"discipline":1,"pressure":-1,"teammate_relation":1}}]'::jsonb
WHERE event_key='rival_training_tension';