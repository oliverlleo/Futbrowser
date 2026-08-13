-- Futbrowser: fictional sponsorship brands and market tiers.
BEGIN;

UPDATE private.career_sponsor_brand_catalog SET tier=1,category='sportswear',min_club_reputation=0,contract_weight=.35,campaign_weight=1.5,max_weekly_deliveries=1,exclusivity_default=false WHERE brand='Linha de Fundo';
UPDATE private.career_sponsor_brand_catalog SET tier=1,category='community',min_club_reputation=0,contract_weight=.4,campaign_weight=1.5,max_weekly_deliveries=1,exclusivity_default=false WHERE brand='Arena+';
UPDATE private.career_sponsor_brand_catalog SET tier=2,category='sportswear',min_club_reputation=3,contract_weight=1.1,campaign_weight=1.0,max_weekly_deliveries=2,exclusivity_default=true WHERE brand='Norte Sports';
UPDATE private.career_sponsor_brand_catalog SET tier=2,category='nutrition',min_club_reputation=3,contract_weight=1.0,campaign_weight=1.0,max_weekly_deliveries=2,exclusivity_default=true WHERE brand='Ritmo Nutrition';
UPDATE private.career_sponsor_brand_catalog SET tier=3,category='sportswear',min_club_reputation=5,contract_weight=1.4,campaign_weight=.7,max_weekly_deliveries=2,exclusivity_default=true WHERE brand='Eleven Wear';
UPDATE private.career_sponsor_brand_catalog SET tier=3,category='technology',min_club_reputation=5,contract_weight=1.2,campaign_weight=.9,max_weekly_deliveries=2,exclusivity_default=true WHERE brand='Pulso Tech';
UPDATE private.career_sponsor_brand_catalog SET tier=4,category='telecom',min_club_reputation=7,contract_weight=1.5,campaign_weight=.7,max_weekly_deliveries=2,exclusivity_default=true WHERE brand='Sprint Mobile';
UPDATE private.career_sponsor_brand_catalog SET tier=4,category='energy',min_club_reputation=7,contract_weight=1.6,campaign_weight=.6,max_weekly_deliveries=3,exclusivity_default=true WHERE brand='Vértice Energy';

INSERT INTO private.career_sponsor_brand_catalog
(brand,profile,profile_label,base_reward,reward_multiplier,min_fame,min_fanbase,min_image,min_form,min_discipline,exposure_risk,description,tier,category,min_club_reputation,contract_weight,campaign_weight,max_weekly_deliveries,exclusivity_default)
VALUES
('Oficina 12 Sports','performance','Desempenho',180,1.00,0,80,38,40,35,1,'Marca esportiva local que aposta em atletas da região.',1,'sportswear',0,.25,1.60,1,false),
('Litoral Fit','discipline','Disciplina',200,1.02,0,100,40,42,40,1,'Rede local ligada a treino, rotina e preparação física.',1,'fitness',0,.25,1.55,1,false),
('Giro Local','community','Comunidade',160,.96,0,70,38,38,30,1,'Aplicativo regional interessado em proximidade com o público.',1,'digital',0,.20,1.70,1,false),
('Estação 90','community','Comunidade',190,1.00,0,90,40,40,35,1,'Loja local de futebol que acompanha jovens promessas.',1,'retail',0,.30,1.55,1,false),
('Costa Norte Bank','discipline','Disciplina',330,1.08,12,350,52,50,50,2,'Fintech regional que procura atletas com imagem confiável.',2,'finance',3,1.00,1.00,2,true),
('Placar One','digital','Alcance digital',360,1.12,15,500,50,50,42,2,'Plataforma esportiva regional com foco em audiência jovem.',2,'digital',3,.90,1.10,2,false),
('Movi+','ambition','Ambição',390,1.16,20,800,52,55,45,2,'Marca nacional em crescimento interessada em atletas ascendentes.',3,'mobility',5,1.20,.85,2,true),
('Atlas Gear','performance','Desempenho',460,1.24,24,1200,55,58,50,2,'Marca esportiva nacional que exige rendimento e consistência.',3,'sportswear',5,1.45,.70,2,true),
('Nexo Play','digital','Alcance digital',500,1.28,30,2500,56,55,45,3,'Ecossistema de mídia e tecnologia com forte exposição nacional.',3,'technology',5,1.30,.85,2,true),
('Prime Eleven','performance','Desempenho',760,1.38,50,12000,62,65,55,3,'Marca premium que trabalha com jogadores já consolidados.',4,'sportswear',7,1.60,.55,3,true),
('Orbe Telecom','digital','Alcance digital',820,1.42,55,18000,60,62,50,3,'Telecom de grande alcance com campanhas de alta exposição.',4,'telecom',7,1.55,.65,3,true),
('Apex World','ambition','Ambição',1300,1.60,80,150000,72,70,62,4,'Marca global reservada a estrelas de enorme exposição esportiva.',5,'sportswear',8,1.80,.45,3,true),
('NovaSphere','digital','Alcance global',1450,1.68,82,180000,70,68,58,4,'Grupo global de tecnologia que contrata apenas atletas de elite.',5,'technology',8,1.80,.50,3,true)
ON CONFLICT(brand) DO UPDATE SET
 profile=EXCLUDED.profile,profile_label=EXCLUDED.profile_label,base_reward=EXCLUDED.base_reward,reward_multiplier=EXCLUDED.reward_multiplier,
 min_fame=EXCLUDED.min_fame,min_fanbase=EXCLUDED.min_fanbase,min_image=EXCLUDED.min_image,min_form=EXCLUDED.min_form,min_discipline=EXCLUDED.min_discipline,
 exposure_risk=EXCLUDED.exposure_risk,description=EXCLUDED.description,tier=EXCLUDED.tier,category=EXCLUDED.category,min_club_reputation=EXCLUDED.min_club_reputation,
 contract_weight=EXCLUDED.contract_weight,campaign_weight=EXCLUDED.campaign_weight,max_weekly_deliveries=EXCLUDED.max_weekly_deliveries,exclusivity_default=EXCLUDED.exclusivity_default;

COMMIT;
