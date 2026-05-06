--
-- PostgreSQL database dump
--


-- Dumped from database version 15.17
-- Dumped by pg_dump version 15.17

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: KbStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."KbStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED'
);


ALTER TYPE public."KbStatus" OWNER TO postgres;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Priority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);


ALTER TYPE public."Priority" OWNER TO postgres;

--
-- Name: QuestionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."QuestionType" AS ENUM (
    'nps',
    'csat',
    'rating',
    'text',
    'textarea',
    'select',
    'multiselect'
);


ALTER TYPE public."QuestionType" OWNER TO postgres;

--
-- Name: Status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Status" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'PENDING',
    'CLOSED'
);


ALTER TYPE public."Status" OWNER TO postgres;

--
-- Name: SurveySendStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SurveySendStatus" AS ENUM (
    'PENDING',
    'SENT',
    'FAILED'
);


ALTER TYPE public."SurveySendStatus" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ActivityLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ActivityLog" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "userId" text,
    action text NOT NULL,
    "oldValue" text,
    "newValue" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ActivityLog" OWNER TO postgres;

--
-- Name: Attachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Attachment" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    filename text NOT NULL,
    "originalName" text NOT NULL,
    mimetype text NOT NULL,
    size integer NOT NULL,
    path text NOT NULL,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "commentId" text
);


ALTER TABLE public."Attachment" OWNER TO postgres;

--
-- Name: Category; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Category" (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    color text NOT NULL,
    icon text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "position" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Category" OWNER TO postgres;

--
-- Name: Client; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Client" (
    id text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    email text,
    phone text,
    company text,
    "roleId" text,
    "isSurveyable" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clubId" text,
    "organisationId" text
);


ALTER TABLE public."Client" OWNER TO postgres;

--
-- Name: ClientClub; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientClub" (
    id text NOT NULL,
    name text NOT NULL,
    "organisationId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ClientClub" OWNER TO postgres;

--
-- Name: ClientOrganisation; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientOrganisation" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ClientOrganisation" OWNER TO postgres;

--
-- Name: ClientPole; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientPole" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ClientPole" OWNER TO postgres;

--
-- Name: ClientRole; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ClientRole" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    color text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "position" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ClientRole" OWNER TO postgres;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "authorId" text NOT NULL,
    content text NOT NULL,
    "isInternal" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Comment" OWNER TO postgres;

--
-- Name: KbArticle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."KbArticle" (
    id text NOT NULL,
    title text NOT NULL,
    content text NOT NULL,
    "categoryId" text,
    tags text[],
    status public."KbStatus" DEFAULT 'DRAFT'::public."KbStatus" NOT NULL,
    "sourceTicketId" text,
    "authorId" text NOT NULL,
    "publishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


ALTER TABLE public."KbArticle" OWNER TO postgres;

--
-- Name: KbAttachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."KbAttachment" (
    id text NOT NULL,
    "articleId" text NOT NULL,
    filename text NOT NULL,
    "originalName" text NOT NULL,
    mimetype text NOT NULL,
    size integer NOT NULL,
    path text NOT NULL,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."KbAttachment" OWNER TO postgres;

--
-- Name: MatchAttachment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."MatchAttachment" (
    id text NOT NULL,
    "matchKey" text NOT NULL,
    "matchDate" timestamp(3) without time zone NOT NULL,
    filename text NOT NULL,
    "originalName" text NOT NULL,
    size integer NOT NULL,
    path text NOT NULL,
    "uploadedById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."MatchAttachment" OWNER TO postgres;

--
-- Name: Role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    permissions text[],
    "roleUpdatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Role" OWNER TO postgres;

--
-- Name: Settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Settings" (
    id text NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Settings" OWNER TO postgres;

--
-- Name: SurveyResponse; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SurveyResponse" (
    id text NOT NULL,
    "surveySendId" text NOT NULL,
    "ticketId" text NOT NULL,
    "clientEmail" text NOT NULL,
    answers jsonb NOT NULL,
    "npsScore" integer,
    "vocScore" double precision,
    "completedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SurveyResponse" OWNER TO postgres;

--
-- Name: SurveySend; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SurveySend" (
    id text NOT NULL,
    "ticketId" text NOT NULL,
    "clientEmail" text NOT NULL,
    "sentAt" timestamp(3) without time zone,
    status public."SurveySendStatus" DEFAULT 'PENDING'::public."SurveySendStatus" NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."SurveySend" OWNER TO postgres;

--
-- Name: SurveyTemplate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SurveyTemplate" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    questions jsonb NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SurveyTemplate" OWNER TO postgres;

--
-- Name: Ticket; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Ticket" (
    id text NOT NULL,
    "ticketNumber" text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    status public."Status" DEFAULT 'OPEN'::public."Status" NOT NULL,
    priority public."Priority" DEFAULT 'MEDIUM'::public."Priority" NOT NULL,
    "categoryId" text,
    "clientId" text NOT NULL,
    "assignedToId" text,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "resolvedAt" timestamp(3) without time zone,
    "closedAt" timestamp(3) without time zone,
    "deletedAt" timestamp(3) without time zone,
    "typeId" text,
    "poleId" text
);


ALTER TABLE public."Ticket" OWNER TO postgres;

--
-- Name: TicketType; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TicketType" (
    id text NOT NULL,
    name text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TicketType" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    "roleId" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "mustChangePassword" boolean DEFAULT true NOT NULL,
    "passwordResetToken" text,
    "passwordResetExpiry" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: ActivityLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ActivityLog" (id, "ticketId", "userId", action, "oldValue", "newValue", "createdAt") FROM stdin;
7ff96522-2ed2-4c0d-98d3-a2b459be31eb	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Catégorie modifié	c3cccf14-2969-4365-930a-61daf65a1989	383fa458-222d-40d7-bf18-5c2c2d0398a5	2026-04-02 14:20:23.595
d5dcb6c1-a261-4d82-98c4-c1ef067d2f92	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Commentaire ajouté	\N	\N	2026-04-02 18:56:36.028
c20fecff-0e0a-4e95-b73f-301241cc955f	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Assigné à : Quentin Vaisala	966d1dd8-f558-40e5-9a71-bee1170b23dc	2367443b-a3ec-4dcf-bc3a-79787c99e04e	2026-04-03 07:21:54.712
6f1a3807-dbce-425b-89cc-83a6feeb0f65	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Statut changé : CLOSED → OPEN	CLOSED	OPEN	2026-04-03 07:22:09.927
0988e17d-f145-4c51-9ef7-2c7752a49e55	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	Ticket créé	\N	\N	2026-04-05 12:00:33.493
ae4e3c25-78ce-4074-9e62-8fc1649d128a	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	Titre modifié	LNH - PSG - Cable SDI trop court pour les cars régies	LNH - PSG - Cable SDI trop court pour les cars régie	2026-04-07 14:37:43.988
b958aaa0-5adf-43ce-ab06-e5f821b8a4c3	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	Statut changé : IN_PROGRESS → CLOSED	IN_PROGRESS	CLOSED	2026-04-08 12:19:22.861
ed1a2544-3069-47b9-a8a9-801e83c242ce	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Description modifié	Ticket avec une description **gras**, *italique* et \n`code`\n-- sous content	Ticket avec une description **gras**, *italique* et \n`code`\n> sous content	2026-04-08 12:40:33.418
74ae5c95-657f-4733-a598-7a370c8dab93	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Description modifié	Ticket avec une description **gras**, *italique* et \n`code`\n> sous content	Ticket avec une description **gras**, *italique* et \n`code`\n>> sous content	2026-04-08 12:40:41.516
c4f7b03a-3159-4467-8a42-aeeeb9f4be85	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Ticket créé	\N	\N	2026-04-02 14:19:35.765
4f0e36f6-529c-42f6-957d-a5ed1ba94ca3	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Commentaire ajouté	\N	\N	2026-04-02 14:23:57.404
71003672-758c-43ed-a4d8-4d0eac303545	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Statut changé : IN_PROGRESS → CLOSED	IN_PROGRESS	CLOSED	2026-04-02 18:59:29.817
c9952cfe-7416-4b76-b047-d55c486bb9bb	862eaee1-6706-4755-88ec-e3b93cdad7f9	966d1dd8-f558-40e5-9a71-bee1170b23dc	Ticket créé	\N	\N	2026-04-03 06:50:34.313
f30fd5ff-9444-4f66-833e-4429d4fe35f1	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Statut changé : OPEN → CLOSED	OPEN	CLOSED	2026-04-03 07:22:34.942
a94a0132-f891-45ed-b065-a4e2d8d7e05b	862eaee1-6706-4755-88ec-e3b93cdad7f9	966d1dd8-f558-40e5-9a71-bee1170b23dc	Note interne ajoutée	\N	\N	2026-04-04 06:39:46.746
2da0d5fb-c16a-4ff3-80f0-e8ec857f6443	862eaee1-6706-4755-88ec-e3b93cdad7f9	966d1dd8-f558-40e5-9a71-bee1170b23dc	Priorité modifié	CRITICAL	HIGH	2026-04-04 06:39:50.929
b8d844af-84f2-444a-8094-9447c568baab	862eaee1-6706-4755-88ec-e3b93cdad7f9	966d1dd8-f558-40e5-9a71-bee1170b23dc	Statut changé : OPEN → IN_PROGRESS	OPEN	IN_PROGRESS	2026-04-04 06:39:52.086
927bcf10-abd9-4b91-8685-466fd68b2dfd	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	Assigné à : Agent test	\N	a4f61051-c454-440e-98d7-1033e893427b	2026-04-07 12:21:38.245
4a3d9ddc-ad86-4d12-904b-ed842a384a0a	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	Statut changé : OPEN → IN_PROGRESS	OPEN	IN_PROGRESS	2026-04-07 14:41:37.931
3ae795c4-8f59-4809-b3a1-def23139fc7a	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Ticket créé	\N	\N	2026-04-08 12:40:13.182
c8ddeb7b-5e28-4d33-b8f3-6ce48c26240d	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Description modifié	Ticket avec une description **gras**, *italique* et \n`code`\n>> sous content	Ticket avec une description **gras**, *italique* et \n`code`\n\n>> sous content	2026-04-08 12:40:45.715
bf63b72d-67af-441e-a2f3-0d50f3f2f5d1	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Description modifié	Ticket avec une description **gras**, *italique* et \n`code`\n\n>> sous content	Ticket avec une description **gras**, *italique* et \n`code`\n\n* sous content	2026-04-08 12:40:51.435
471225a4-120e-49fc-9458-d6013d74c2c7	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Description modifié	Ticket avec une description **gras**, *italique* et \n`code`\n\n* sous content	Ticket avec une description **gras**, *italique* et \n`code`\n	2026-04-08 12:41:03.91
7b3d3d9e-a619-47fe-aa8c-353b02a456e0	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Catégorie modifié	c3cccf14-2969-4365-930a-61daf65a1989		2026-04-08 12:41:17.412
375b3f8b-4c30-4fdd-90ac-32ea779d45e6	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Priorité modifié	CRITICAL	MEDIUM	2026-04-08 12:41:23.84
a3f84fd9-d9d7-4b98-b1bc-73ffad77fa9d	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Statut changé : OPEN → IN_PROGRESS	OPEN	IN_PROGRESS	2026-04-02 14:19:53.048
60f74774-d1de-4919-b49a-54f7d0f7b3d6	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Commentaire ajouté	\N	\N	2026-04-02 14:36:31.334
ea325d84-28b6-4516-b870-f99f1db18000	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Titre modifié	LNR - PROD2 - Grenoble pas de son sur flux PGM	LNR - PROD2 - Grenoble -  Pas de son sur flux PGM	2026-04-03 06:55:52.062
aa708083-3d69-4e3f-b237-9fe8216330e9	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Catégorie modifié	383fa458-222d-40d7-bf18-5c2c2d0398a5	c3cccf14-2969-4365-930a-61daf65a1989	2026-04-04 06:51:18.514
9459165e-79d2-4b52-9007-3cb3bf7fcb46	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	Assigné à : Nicolas Broutin	a4f61051-c454-440e-98d7-1033e893427b	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-07 14:18:26.46
c12342f3-ca92-4058-afeb-8fe37d01cb03	862eaee1-6706-4755-88ec-e3b93cdad7f9	bec542d0-8463-4e5b-a008-9bfc9e3bc7a7	Statut changé : IN_PROGRESS → CLOSED	IN_PROGRESS	CLOSED	2026-04-07 15:15:03.521
8d39c2fb-c8bb-4485-a9ea-c9f3ba2cd670	bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	f026476a-77e9-4200-ae91-ec38b96da240	Description modifié	Ticket avec une description **gras**, *italique* et \n`code`\n- sous content	Ticket avec une description **gras**, *italique* et \n`code`\n-- sous content	2026-04-08 12:40:24.829
\.


--
-- Data for Name: Attachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Attachment" (id, "ticketId", filename, "originalName", mimetype, size, path, "uploadedById", "createdAt", "commentId") FROM stdin;
\.


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Category" (id, name, slug, color, icon, description, "isActive", "position", "createdAt", "updatedAt") FROM stdin;
c52f95bc-85d1-4003-8238-2419e8e3996f	Matériel	materiel	#185FA5	Monitor	\N	t	1	2026-03-18 19:58:07.045	2026-03-18 19:58:07.045
383fa458-222d-40d7-bf18-5c2c2d0398a5	Logiciel	logiciel	#534AB7	Code	\N	t	2	2026-03-18 19:58:07.05	2026-03-18 19:58:07.05
852dcf77-1bb5-40c2-8ef0-0288f2d1fc01	Réseau	reseau	#0F6E56	Wifi	\N	t	3	2026-03-18 19:58:07.052	2026-03-18 19:58:07.052
bfe4bba0-8562-489a-b9c9-7a418d5e2964	Accès	acces	#854F0B	Lock	\N	t	4	2026-03-18 19:58:07.054	2026-03-18 19:58:07.054
c3cccf14-2969-4365-930a-61daf65a1989	Autre	autre	#5F5E5A	LifeBuoy	\N	t	5	2026-03-18 19:58:07.056	2026-03-18 19:58:07.056
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Client" (id, "firstName", "lastName", email, phone, company, "roleId", "isSurveyable", notes, "createdAt", "updatedAt", "clubId", "organisationId") FROM stdin;
441c7e17-b4a3-4d51-a9b3-67c389aa9c15	Lucile	Piotin	e@e.fr	0621635047	AMP TV	11981bdd-11f5-4d07-9f07-4fffff4bbf92	f	\N	2026-04-02 14:18:23.387	2026-04-02 14:18:23.387	\N	\N
21f9aa77-978a-448e-b903-f985e2223e72	Flora	Puchois	f.puchois@montpellierhandball.com	0750145842	MHB	d622ba35-bf15-4e87-ad2a-ee25e14af082	t		2026-04-03 06:49:04.624	2026-04-03 07:02:10.551	497a613c-9243-4603-bc86-a17cb724898f	f5e68be0-baf6-441c-97bc-413d473472ec
3a82597b-77b3-4b56-a96a-7a8885a42c53	David	Romain	romain.david@fcgrugby.com	0757407012	FC Grenoble Rugby	d622ba35-bf15-4e87-ad2a-ee25e14af082	t		2026-04-02 09:03:25.357	2026-04-03 07:02:30.318	a54eae7e-3f10-4abb-a244-275d2d018440	b53b7540-2c35-4b58-916b-28b3c64d3282
fd381b99-ca33-4228-8743-3134c8d163fe	Prudhomme	Nicolas	no@email.com	 06 50 76 60 75	AMP TV	11981bdd-11f5-4d07-9f07-4fffff4bbf92	f	Chef de Car	2026-04-04 06:55:39.37	2026-04-04 06:55:39.37	\N	\N
6e37e071-e023-4cd4-9df1-24adcc069b11	Zervilis	Blaise	no@email.com	06 26 87 67 16	Tremblay HBC	a14f5622-557f-462c-bb13-994c007e6756	f		2026-04-04 06:56:45.98	2026-04-04 06:57:24.196	791e1c8e-9315-4747-be91-2d4e25e11a7f	f5e68be0-baf6-441c-97bc-413d473472ec
d70e47cf-b4e0-48dd-b978-fe2e5e618987	Jean Philippe	ALBARET	noemail@mail.com	06 52 97 94 92	Via Storia	11981bdd-11f5-4d07-9f07-4fffff4bbf92	f	\N	2026-04-05 12:00:30.705	2026-04-05 12:00:30.705	\N	\N
9bb0f23f-f446-45f5-8f12-456142269e9d	Paul	GARRIC	pgarric@montpellier-rugby.com	07 84 33 97 12	MHR	d622ba35-bf15-4e87-ad2a-ee25e14af082	f		2026-04-07 15:07:18.153	2026-04-08 12:17:57.458	d3ab84b8-bbf5-4ded-9679-6920b9382fd6	b53b7540-2c35-4b58-916b-28b3c64d3282
3d263708-9a3b-4f43-9c27-a22a39f93e96	Lucas	HERBRETEAU	e@e.fr	0674113846	IXI Live	11981bdd-11f5-4d07-9f07-4fffff4bbf92	f	\N	2026-04-08 12:37:52.576	2026-04-08 12:37:52.576	\N	\N
\.


--
-- Data for Name: ClientClub; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ClientClub" (id, name, "organisationId", "isActive", "position", "createdAt", "updatedAt") FROM stdin;
c8ceec2e-63f1-43ed-9635-3456bef8f208	Section Paloise	b53b7540-2c35-4b58-916b-28b3c64d3282	t	1	2026-03-20 13:49:43.67	2026-03-20 13:49:43.67
00544357-fc3c-466d-baca-edee06eb0624	MHB	f5e68be0-baf6-441c-97bc-413d473472ec	t	3	2026-03-20 13:49:57.098	2026-03-20 13:49:57.098
1c571b76-d41c-4982-8b69-7bd3e74337cc	Club athlétique Brive Corrèze Limousin	b53b7540-2c35-4b58-916b-28b3c64d3282	t	2	2026-03-20 13:49:51.146	2026-03-20 13:50:29.859
a62c5b52-879c-4d91-bc30-0728bfd18b59	Provence Rugby	b53b7540-2c35-4b58-916b-28b3c64d3282	t	4	2026-03-26 14:47:13.414	2026-03-26 14:47:13.414
bded1ab0-5aa7-4c93-b543-5aac85dd1303	Colomiers	b53b7540-2c35-4b58-916b-28b3c64d3282	t	5	2026-03-26 14:47:26.675	2026-03-26 14:47:26.675
a54eae7e-3f10-4abb-a244-275d2d018440	FC Grenoble Rugby	b53b7540-2c35-4b58-916b-28b3c64d3282	t	6	2026-04-02 09:03:19.462	2026-04-02 09:03:19.462
0021f6c1-b0d9-4166-b4a2-d84b0c5e6065	Stade Rochelais	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.96	2026-04-02 13:56:46.96
9b6a6093-9f79-4e30-b87c-51effb8527bd	Union Bordeaux-Begles	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.962	2026-04-02 13:56:46.962
2ab793e2-f374-4009-80d7-80bd395a8ccb	ASM Clermont	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.963	2026-04-02 13:56:46.963
098e41de-2a06-4e9f-aadb-3a54f9edb957	LOU Rugby	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.964	2026-04-02 13:56:46.964
f4ebf070-4d43-41eb-9928-1726638c729b	Aviron Bayonnais	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.965	2026-04-02 13:56:46.965
d3ab84b8-bbf5-4ded-9679-6920b9382fd6	Montpellier Herault Rugby	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.967	2026-04-02 13:56:46.967
00dbfa2b-44b6-4a28-88e5-1f0768cbb9b7	USA Perpignan	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.968	2026-04-02 13:56:46.968
d82aac54-1493-42e8-aac6-5310e03669fa	US Montauban	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.969	2026-04-02 13:56:46.969
50024c8c-cff2-424f-94c8-6b6a642feb3e	RC Toulon	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.97	2026-04-02 13:56:46.97
7c953581-38e3-4c74-8eb8-e2acfed6903b	Castres Olympique	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.971	2026-04-02 13:56:46.971
21af0f4e-6df5-46ae-bf56-28b875609de5	Stade Toulousain	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.971	2026-04-02 13:56:46.971
ab00998f-2ec8-4f55-bf53-389cb8435ffc	Racing 92	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.973	2026-04-02 13:56:46.973
1f72a5f3-e38b-47b0-bf77-07d32bc537ab	Stade Francais Paris	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.973	2026-04-02 13:56:46.973
557559fe-397f-44e7-998d-5361bce827ae	Valence Romans	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.975	2026-04-02 13:56:46.975
10072c7b-2d72-460f-ae90-9b934cabb31c	SU Agen	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.975	2026-04-02 13:56:46.975
38279a09-1d5c-4a0b-80d8-e748c3721aa3	RC Vannes	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.976	2026-04-02 13:56:46.976
d835f44d-512d-4562-a456-fff51666ded4	Colomiers Rugby	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.977	2026-04-02 13:56:46.977
703dcf61-fbbd-410c-8e1f-b8ea2d0021b9	US Dax	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.978	2026-04-02 13:56:46.978
33cef3d3-2c0d-40fb-8599-b0791ba1669e	Oyonnax Rugby	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.978	2026-04-02 13:56:46.978
4abf94b3-6a4f-4052-a326-5ded92c2b9ce	Biarritz Olympique PB	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.979	2026-04-02 13:56:46.979
2ea8c4d5-ea20-4472-b679-e75e24566016	Soyaux-Angouleme XV	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.98	2026-04-02 13:56:46.98
e741ac26-b457-421f-8419-093ede0b73ef	US Carcassonnaise	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.98	2026-04-02 13:56:46.98
f80f0de5-7598-4af7-abfa-8c52b46b3fef	Stade Montois Rugby	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.981	2026-04-02 13:56:46.981
96af7cae-d46e-4278-abdb-ab922f1d0fe8	Stade Aurillacois	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.982	2026-04-02 13:56:46.982
930f7543-72b0-45a6-ab19-076e8cec7b80	USON Nevers	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.982	2026-04-02 13:56:46.982
b7e7ea2b-7529-46ca-9b4a-93f4444ddab7	AS Beziers Herault	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.983	2026-04-02 13:56:46.983
f785cd2a-ebd1-48ce-bbf2-2fddee06d978	CA Brive	b53b7540-2c35-4b58-916b-28b3c64d3282	t	0	2026-04-02 13:56:46.984	2026-04-02 13:56:46.984
00a82e30-13f9-4566-8d81-d74add93e4f6	Aix	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.986	2026-04-02 13:56:46.986
9de6c492-9b98-4d48-abb6-b2e81644a1b0	Cesson-Rennes	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.987	2026-04-02 13:56:46.987
5ad1a322-4819-46a8-8344-101b4cfdc5d1	Chambery	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.988	2026-04-02 13:56:46.988
10bfc60d-c4c4-4ffc-ada6-a1637920ab27	Chartres	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.989	2026-04-02 13:56:46.989
2eaf0cf0-e195-4a98-975f-2824f2105dec	Dijon	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.99	2026-04-02 13:56:46.99
bdbb7b65-181a-4b9c-89b7-197d360d13f1	Dunkerque	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.99	2026-04-02 13:56:46.99
f6627294-e7af-4fae-8af3-3310a9e7b86f	Istres	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.991	2026-04-02 13:56:46.991
412bad96-d613-430e-90b1-3f14ea6ef77a	Limoges	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.992	2026-04-02 13:56:46.992
497a613c-9243-4603-bc86-a17cb724898f	Montpellier	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.992	2026-04-02 13:56:46.992
76b49aab-cf53-40e9-ba1b-65c6c947cc34	Nantes	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.993	2026-04-02 13:56:46.993
ab8b2674-5815-449c-9eeb-ee23d584a86a	Nimes	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.994	2026-04-02 13:56:46.994
994c65d3-1480-4f25-a8f0-5187d301ebd0	Paris	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.995	2026-04-02 13:56:46.995
642eb9a3-12e0-45b5-b31b-2bc966689fb7	Saint-Raphael	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.995	2026-04-02 13:56:46.995
503e190a-c1a7-405d-8f33-04a32956e5a9	Selestat	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.996	2026-04-02 13:56:46.996
06c8bcc8-9477-4734-9e64-ac22b545af69	Toulouse	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.997	2026-04-02 13:56:46.997
791e1c8e-9315-4747-be91-2d4e25e11a7f	Tremblay	f5e68be0-baf6-441c-97bc-413d473472ec	t	0	2026-04-02 13:56:46.997	2026-04-02 13:56:46.997
\.


--
-- Data for Name: ClientOrganisation; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ClientOrganisation" (id, name, "isActive", "position", "createdAt", "updatedAt") FROM stdin;
b53b7540-2c35-4b58-916b-28b3c64d3282	LNR	t	1	2026-03-20 13:48:59.504	2026-03-20 13:48:59.504
f5e68be0-baf6-441c-97bc-413d473472ec	LNH	t	2	2026-03-20 13:49:04.758	2026-03-20 13:49:04.758
b5cfedb1-26f3-4c71-8d4c-249abc03242a	FFR	t	3	2026-03-20 13:49:10.481	2026-03-20 13:49:10.481
e2ce43df-7fe1-43d5-8780-b375a68632d3	ELMS	t	4	2026-03-20 13:49:16.203	2026-03-20 13:49:16.203
5a948f8c-939b-4a0d-8035-f893e274c480	EJL	t	5	2026-03-20 13:49:30.046	2026-03-20 13:49:30.046
\.


--
-- Data for Name: ClientPole; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ClientPole" (id, name, "isActive", "position", "createdAt", "updatedAt") FROM stdin;
39e36924-1dc0-4e8f-b544-affdecd6eac6	Vogo Helpdesk	t	1	2026-03-24 11:39:51.982	2026-03-24 11:39:51.982
7737fb47-40fb-4eec-be81-6c974b719a98	Techniciens	t	2	2026-03-24 11:40:01.614	2026-03-24 11:40:01.614
\.


--
-- Data for Name: ClientRole; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ClientRole" (id, name, description, color, "isActive", "position", "createdAt", "updatedAt") FROM stdin;
a14f5622-557f-462c-bb13-994c007e6756	Responsable IT	\N	#185FA5	t	1	2026-03-18 19:58:07.059	2026-03-26 15:15:28.607
d622ba35-bf15-4e87-ad2a-ee25e14af082	Stadium Manager		#0F6E56	t	2	2026-03-18 19:58:07.062	2026-03-26 15:15:28.607
d9492a11-250a-49a4-a852-a1e43dc1f927	Prestataire	\N	#854F0B	t	3	2026-03-18 19:58:07.066	2026-03-26 15:15:28.607
11981bdd-11f5-4d07-9f07-4fffff4bbf92	Equipe Prod		#E24B4A	t	4	2026-03-18 19:58:07.065	2026-03-26 15:15:28.607
3096b671-a26c-4fd5-a081-98d15b8857f7	Equipe TV		#D4537E	t	5	2026-03-18 19:58:07.068	2026-03-26 15:15:28.607
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Comment" (id, "ticketId", "authorId", content, "isInternal", "createdAt", "updatedAt") FROM stdin;
30bb307f-254d-440f-be72-51f220ddfcf9	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Message de la chargée de production : pour elle c'est maintenant OK (sans précision sur l'intervention de AMP).\r\nVérification du fichier via le record VOGO : on a bien de l'audio sans pouvoir être sûr que ce c'est la conférence arbitre.\r\n\r\nTest a faire a 20:40 avec uin nouveau record pour verifier le son dans le flux 1	f	2026-04-02 14:36:31.324	2026-04-02 14:36:31.324
de1e80d4-0ca1-49ef-9bb0-a0a7cd789b27	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Fermeture car match démarré, l'audio qui etait absen,t au depart a été ajouté. Aucune possibilité de voir si l'equipe AMP a bien configuré le bon audio.	t	2026-04-02 18:59:29.814	2026-04-02 18:59:29.814
d7c8c8cf-ab28-4b88-856c-13ac8d0d7e0c	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	Résolution sans solution : ViaStoria peut se deplacer de quelques metres en tribunes ce qui rends nos cables SDI trop courts	t	2026-04-08 12:19:22.846	2026-04-08 12:19:22.846
64e5e6da-5f9f-44a0-9379-1f8545284e1d	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Reponse chargée de production : elle fait vérification avec le son et reviens vers nous. \r\nDans la foulée nous constatons le vuemetre s'activer, prise d'un clip afin de verifier l'audio.	f	2026-04-02 14:23:57.39	2026-04-02 14:23:57.39
6608dc98-60e3-44af-bcd5-21bc8a532156	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Le clip enregistré comporte l'audio du stade, comme si un micro etait ouvert mais pas de voix arbitre audible. \r\nPas plus de tests possible. \r\nKO dans 5mn.	f	2026-04-02 18:56:36.004	2026-04-02 18:56:36.004
21494e04-d09b-4491-9463-67e84d04fc21	d7e1ad0c-686f-4da9-8946-b6db263c7099	966d1dd8-f558-40e5-9a71-bee1170b23dc	Changement d'assignation	t	2026-04-03 07:22:34.93	2026-04-03 07:22:34.93
3dea7576-1e3e-4ff0-85a7-a3024a0304eb	862eaee1-6706-4755-88ec-e3b93cdad7f9	966d1dd8-f558-40e5-9a71-bee1170b23dc	Déplacement le mardi 07/04 pour intervention : Rojo / Nicolas	t	2026-04-04 06:39:46.734	2026-04-04 06:39:46.734
b004b369-b5e5-4610-8cc6-af6be05c848b	862eaee1-6706-4755-88ec-e3b93cdad7f9	bec542d0-8463-4e5b-a008-9bfc9e3bc7a7	Prise RJ remplacée ce jour. Prise détériorée par un tiers sur site. Intervention non facturée. Rappel vigilance client	t	2026-04-07 15:15:03.503	2026-04-07 15:15:03.503
\.


--
-- Data for Name: KbArticle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."KbArticle" (id, title, content, "categoryId", tags, status, "sourceTicketId", "authorId", "publishedAt", "createdAt", "updatedAt", "deletedAt") FROM stdin;
ad45e448-8d81-4d20-b45c-687831bbf6be	Test création article	<p>Test&nbsp;</p><img src="/uploads/kb/5ca0ece5-7632-4373-9e9a-8e5e32106076.png"><p></p><p></p><p></p>	c52f95bc-85d1-4003-8238-2419e8e3996f	{test,blablabla}	DRAFT	\N	966d1dd8-f558-40e5-9a71-bee1170b23dc	\N	2026-04-08 12:09:25.171	2026-04-08 12:16:33.096	2026-04-08 12:16:33.095
796e345b-2022-4b10-bc22-771979ed227f	LNH - PSG - Cable SDI trop court pour les cars régie	<h2>Problème</h2><p>Le cable SDI est trop court, la societé de production est obligée d'utiliser des rallonges.</p>	c52f95bc-85d1-4003-8238-2419e8e3996f	{}	PUBLISHED	370053c7-abd9-4710-a3f2-bc9124feb472	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 12:19:32.347	2026-04-08 12:19:32.326	2026-04-08 12:19:32.348	\N
\.


--
-- Data for Name: KbAttachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."KbAttachment" (id, "articleId", filename, "originalName", mimetype, size, path, "uploadedById", "createdAt") FROM stdin;
c294accb-9cce-4a36-ae0a-9ecfff384d08	ad45e448-8d81-4d20-b45c-687831bbf6be	5ca0ece5-7632-4373-9e9a-8e5e32106076.png	Capture d'Ã©cran 2026-03-26 192402.png	image/png	554142	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\kb\\5ca0ece5-7632-4373-9e9a-8e5e32106076.png	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 12:10:25.697
\.


--
-- Data for Name: MatchAttachment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."MatchAttachment" (id, "matchKey", "matchDate", filename, "originalName", size, path, "uploadedById", "createdAt") FROM stdin;
664380a3-b81b-4ded-9408-9d70eb76d425	LNH_Nîmes_Aix_2026-04-10T18:00:00.000Z	2026-04-10 18:00:00	23597c47-3d25-4e5b-803f-44379d792cf3.pdf	CONSIGNES LMSL NIMES VS AIX 10042026.pdf	603146	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\23597c47-3d25-4e5b-803f-44379d792cf3.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-07 11:13:21.339
dc36bd30-73ba-4cb6-bcee-402f698ca173	LNH_Nîmes_Aix_2026-04-10T18:00:00.000Z	2026-04-10 18:00:00	4fc58f33-3197-486e-9db3-3a3b9191911c.pdf	PLAN CAM STANDARD LNH NIMES POURADIER.pdf	993376	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\4fc58f33-3197-486e-9db3-3a3b9191911c.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-07 11:13:36.941
b76528d9-7696-45a7-8bd9-d2aa1e5e196c	LNH_Chambéry_Tremblay_2026-04-10T18:00:00.000Z	2026-04-10 18:00:00	74f25834-9f12-42d1-8e7f-bb98963d08b3.pdf	LMSL - FDS - ChambeÌry _ Tremblay - Vendredi 10 Avril.pdf	190522	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\74f25834-9f12-42d1-8e7f-bb98963d08b3.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 07:17:21.826
9ec825e5-87e3-484d-baab-1dba07e45451	LNH_Dijon_Limoges_2026-04-10T18:30:00.000Z	2026-04-10 18:30:00	a13b9c98-b1d7-4cbe-899e-0aaf6425a8e8.pdf	LMSL - FDS - Dijon _ Limoges - Vendredi 10 Avril 2026.pdf	192811	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\a13b9c98-b1d7-4cbe-899e-0aaf6425a8e8.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 07:18:01.694
8dbcac91-5d7a-4e9e-ab6e-fa794774afa4	LNH_Sélestat_Istres_2026-04-10T18:30:00.000Z	2026-04-10 18:30:00	6aa537dc-bfe3-4b03-bfd3-dd2dedc66379.pdf	LMSL - FDS - SeÌlestat _ Istres - Vendredi 10 Avril 2026.pdf	201026	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\6aa537dc-bfe3-4b03-bfd3-dd2dedc66379.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 07:18:04.249
67a3228b-01c1-4d46-9d86-b6e2aa52a611	LNH_Montpellier_Dunkerque_2026-04-11T18:00:00.000Z	2026-04-11 18:00:00	87263eab-80be-4c5a-9a23-d9de652caf2e.pdf	LIQUI MOLY STAR LIGUE - MONTPELLIER vs DUNKERQUE.pdf	831217	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\87263eab-80be-4c5a-9a23-d9de652caf2e.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 10:13:06.674
6f42f97a-9263-4d94-9a38-dddd4e74e78f	LNH_Montpellier_Dunkerque_2026-04-11T18:00:00.000Z	2026-04-11 18:00:00	5114fbb4-e93d-4d5b-b5d1-bf15d0b67a17.pdf	BeIn LNH Montpellier MHB FDi 25-26.pdf	2109546	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\5114fbb4-e93d-4d5b-b5d1-bf15d0b67a17.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 10:13:11.46
d925899e-0063-4c38-8ab7-54611af35877	LNH_Cesson-Rennes_Chartres_2026-04-12T16:00:00.000Z	2026-04-12 16:00:00	4d23f7c2-dfb7-4d2e-9e35-8b8a1bbb8e1d.pdf	LMSL - FDS - Cesson-Rennes _ Chartres - Dimanche 12 Avril 2026.pdf	182427	C:\\Users\\NicolasBROUTIN\\Documents\\HELPDESK PROJECT\\server\\uploads\\match-attachments\\4d23f7c2-dfb7-4d2e-9e35-8b8a1bbb8e1d.pdf	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-08 13:59:06.759
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Role" (id, name, description, "isSystem", permissions, "roleUpdatedAt", "createdAt", "updatedAt") FROM stdin;
54350154-0a3f-424c-be05-cbaf52cbee9c	Administrateur	Accès complet à toutes les fonctionnalités	t	{tickets.view,tickets.create,tickets.edit,tickets.close,tickets.delete,tickets.assign,tickets.viewAll,clients.view,clients.create,clients.edit,clients.delete,comments.create,comments.delete,comments.deleteAny,surveys.view,surveys.configure,admin.access,admin.users,admin.roles,admin.categories,admin.clientRoles,admin.settings,kb.read,kb.write}	2026-04-08 12:09:04.65	2026-03-18 19:58:06.569	2026-04-08 12:09:04.651
a35dcb49-584c-40ff-b832-44a76d122fe3	Agent	Agent de support standard	t	{tickets.view,tickets.create,tickets.edit,tickets.close,tickets.assign,tickets.viewAll,clients.view,clients.create,clients.edit,comments.create,comments.delete,kb.read,kb.write}	2026-04-08 12:08:58.504	2026-03-18 19:58:06.576	2026-04-08 12:09:56.565
\.


--
-- Data for Name: Settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Settings" (id, key, value, "updatedAt") FROM stdin;
ab401f4b-65a4-4b2a-bf81-b2549035932e	logo_url	/uploads/logo/logo.png	2026-03-19 08:25:58.602
c7ebd574-40f5-46ff-b57a-bf07dcc47cd5	survey_delay_hours	12	2026-03-26 15:30:25.2
4a4be17b-2317-467b-ade6-dfb728694dba	survey_cooldown_days	15	2026-03-26 15:30:25.2
420dbb57-c99c-4693-9817-7ee88210d38a	company_name	VOGO HELPDESK	2026-03-26 15:30:38.801
056a79ad-b5d9-4332-ab0f-58a6663e2c0e	survey_enabled	false	2026-04-02 14:05:22.431
\.


--
-- Data for Name: SurveyResponse; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SurveyResponse" (id, "surveySendId", "ticketId", "clientEmail", answers, "npsScore", "vocScore", "completedAt", "createdAt") FROM stdin;
\.


--
-- Data for Name: SurveySend; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SurveySend" (id, "ticketId", "clientEmail", "sentAt", status, token, "createdAt") FROM stdin;
\.


--
-- Data for Name: SurveyTemplate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SurveyTemplate" (id, name, "isActive", questions, "createdAt", "updatedAt") FROM stdin;
df6a26fa-7a65-4b47-b3f6-72a80df81fc7	Modèle standard	f	[{"id": "q1_csat", "type": "csat", "label": "Comment évaluez-vous votre satisfaction globale concernant le traitement de votre demande ?", "order": 1, "config": {"max": 5, "min": 1, "maxLabel": "5 = Très satisfait", "minLabel": "1 = Très insatisfait"}, "required": true}, {"id": "q1b_csat_comment", "type": "textarea", "label": "Qu'est-ce qui vous a déplu ou pourrait être amélioré ?", "order": 2, "config": {"showIf": {"value": 3, "operator": "lte", "questionId": "q1_csat"}}, "helpText": "Votre retour nous aide à progresser", "required": false}, {"id": "q2_nps", "type": "nps", "label": "Sur une échelle de 0 à 10, quelle est la probabilité que vous nous recommandiez à un proche ou un collègue ?", "order": 3, "config": {"max": 10, "min": 0, "maxLabel": "Très probable", "minLabel": "Pas du tout probable"}, "required": true}, {"id": "q3_speed", "type": "rating", "label": "Comment évaluez-vous la rapidité de traitement de votre demande ?", "order": 4, "config": {"max": 5, "min": 1, "maxLabel": "Très rapide", "minLabel": "Très lent"}, "required": true}, {"id": "q4_quality", "type": "rating", "label": "Comment évaluez-vous la qualité de la solution apportée ?", "order": 5, "config": {"max": 5, "min": 1, "maxLabel": "Excellente", "minLabel": "Insuffisante"}, "required": true}, {"id": "q5_professionalism", "type": "select", "label": "Le technicien qui a traité votre demande était-il ?", "order": 6, "options": ["Très professionnel", "Professionnel", "Correct", "Peu professionnel"], "required": false}, {"id": "q6_comment", "type": "textarea", "label": "Avez-vous des commentaires ou suggestions pour améliorer notre service ?", "order": 7, "helpText": "Votre retour nous aide à progresser", "required": false}]	2026-03-18 19:59:35.25	2026-03-19 13:06:03.1
be77d5c6-1cbb-4f1d-b640-f6ca0906ee35	Modèle enquête	f	[{"id": "q1_csat", "type": "csat", "label": "Comment évaluez-vous votre satisfaction globale concernant le traitement de votre demande ?", "order": 1, "config": {"max": 5, "min": 1, "maxLabel": "5 = Très satisfait", "minLabel": "1 = Très insatisfait"}, "required": true}, {"id": "q1b_csat_comment", "type": "textarea", "label": "Qu'est-ce qui vous a déplu ou pourrait être amélioré ?", "order": 2, "config": {"showIf": {"value": 3, "operator": "lte", "questionId": "q1_csat"}}, "helpText": "Votre retour nous aide à progresser", "required": false}, {"id": "q3_speed", "type": "rating", "label": "Comment évaluez-vous la rapidité de traitement de votre demande ?", "order": 3, "config": {"max": 5, "min": 1, "maxLabel": "Très rapide", "minLabel": "Très lent"}, "required": true}, {"id": "q4_quality", "type": "rating", "label": "Comment évaluez-vous la qualité de la solution apportée ?", "order": 4, "config": {"max": 5, "min": 1, "maxLabel": "Excellente", "minLabel": "Insuffisante"}, "required": true}, {"id": "q6_comment", "type": "textarea", "label": "Avez-vous des commentaires ou suggestions pour améliorer notre service ?", "order": 5, "helpText": "Votre retour nous aide à progresser", "required": false}, {"id": "q2_nps", "type": "nps", "label": "Sur une échelle de 0 à 10, quelle est la probabilité que vous nous recommandiez à un proche ou un collègue ?", "order": 6, "config": {"max": 10, "min": 0, "maxLabel": "Très probable", "minLabel": "Pas du tout probable"}, "required": true}]	2026-03-19 13:05:54.958	2026-03-19 13:06:03.1
c934f1e5-32fd-4c71-b330-cb11ba17bb64	Modèle enquête	t	[{"id": "q1_csat", "type": "csat", "label": "Comment évaluez-vous votre satisfaction globale concernant le traitement de votre demande ?", "order": 1, "config": {"max": 5, "min": 1, "maxLabel": "5 = Très satisfait", "minLabel": "1 = Très insatisfait"}, "required": true}, {"id": "q1b_csat_comment", "type": "textarea", "label": "Qu'est-ce qui vous a déplu ou pourrait être amélioré ?", "order": 2, "config": {"showIf": {"value": 3, "operator": "lte", "questionId": "q1_csat"}}, "helpText": "Votre retour nous aide à progresser", "required": false}, {"id": "q3_speed", "type": "rating", "label": "Comment évaluez-vous la rapidité de traitement de votre demande ?", "order": 3, "config": {"max": 5, "min": 1, "maxLabel": "Très rapide", "minLabel": "Très lent"}, "required": true}, {"id": "q4_quality", "type": "rating", "label": "Comment évaluez-vous la qualité de la solution apportée ?", "order": 4, "config": {"max": 5, "min": 1, "maxLabel": "Excellente", "minLabel": "Insuffisante"}, "required": true}, {"id": "q6_comment", "type": "textarea", "label": "Avez-vous des commentaires ou suggestions pour améliorer notre service ?", "order": 5, "helpText": "Votre retour nous aide à progresser", "required": false}]	2026-03-19 13:06:03.104	2026-03-19 13:06:03.104
\.


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Ticket" (id, "ticketNumber", title, description, status, priority, "categoryId", "clientId", "assignedToId", "createdById", "createdAt", "updatedAt", "resolvedAt", "closedAt", "deletedAt", "typeId", "poleId") FROM stdin;
862eaee1-6706-4755-88ec-e3b93cdad7f9	VG20260002	LNH - MHB - Prise RJ45 defectueuse	La prise RJ45 pour brancher la VAR a été complètement arrachée…	CLOSED	HIGH	c52f95bc-85d1-4003-8238-2419e8e3996f	21f9aa77-978a-448e-b903-f985e2223e72	966d1dd8-f558-40e5-9a71-bee1170b23dc	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-03 06:50:34.297	2026-04-07 15:15:03.491	2026-04-07 15:15:03.49	2026-04-07 15:15:03.49	\N	de226dfc-e79a-43a3-84ea-d0389dd32809	7737fb47-40fb-4eec-be81-6c974b719a98
370053c7-abd9-4710-a3f2-bc9124feb472	VG20260003	LNH - PSG - Cable SDI trop court pour les cars régie	Le cable SDI est trop court, la societé de production est obligée d'utiliser des rallonges.	CLOSED	LOW	c52f95bc-85d1-4003-8238-2419e8e3996f	d70e47cf-b4e0-48dd-b978-fe2e5e618987	966d1dd8-f558-40e5-9a71-bee1170b23dc	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-05 12:00:33.484	2026-04-08 12:19:22.835	2026-04-08 12:19:22.834	2026-04-08 12:19:22.834	\N	de226dfc-e79a-43a3-84ea-d0389dd32809	7737fb47-40fb-4eec-be81-6c974b719a98
d7e1ad0c-686f-4da9-8946-b6db263c7099	VG20260001	LNR - PROD2 - Grenoble -  Pas de son sur flux PGM	Pas de son detecté lors des verifications pre-match sur le flux PGM :\nSMS a la chargée de production afin de demander d'envoyer le mix arbitre sur le flux 1	CLOSED	LOW	c3cccf14-2969-4365-930a-61daf65a1989	441c7e17-b4a3-4d51-a9b3-67c389aa9c15	2367443b-a3ec-4dcf-bc3a-79787c99e04e	966d1dd8-f558-40e5-9a71-bee1170b23dc	2026-04-02 14:19:35.756	2026-04-04 06:51:18.511	2026-04-02 18:59:29.8	2026-04-03 07:22:34.919	\N	de226dfc-e79a-43a3-84ea-d0389dd32809	39e36924-1dc0-4e8f-b544-affdecd6eac6
bf1e048e-cce1-4fe6-8bc6-85e076f4f1d0	VG20260004	Test d'un ticket	Ticket avec une description **gras**, *italique* et \n`code`\n	OPEN	MEDIUM	\N	3d263708-9a3b-4f43-9c27-a22a39f93e96	\N	f026476a-77e9-4200-ae91-ec38b96da240	2026-04-08 12:40:13.174	2026-04-08 12:41:23.834	\N	\N	\N	de226dfc-e79a-43a3-84ea-d0389dd32809	39e36924-1dc0-4e8f-b544-affdecd6eac6
\.


--
-- Data for Name: TicketType; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TicketType" (id, name, "isActive", "position", "createdAt", "updatedAt") FROM stdin;
297fc76e-5b47-44f2-8b81-44f213236faa	Maintenance Annuelle	t	1	2026-03-24 11:40:13.322	2026-03-24 11:40:13.322
de226dfc-e79a-43a3-84ea-d0389dd32809	Incident	t	2	2026-03-24 11:40:17.584	2026-03-24 11:40:17.584
c6ea8589-86f5-4197-a58a-3ee225284336	Chaperonnage	t	3	2026-03-24 11:40:39.2	2026-03-24 11:40:39.2
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, "firstName", "lastName", email, password, "roleId", "isActive", "mustChangePassword", "passwordResetToken", "passwordResetExpiry", "createdAt", "updatedAt") FROM stdin;
966d1dd8-f558-40e5-9a71-bee1170b23dc	Nicolas	Broutin	n.broutin@vogo-group.com	$2b$12$sE25La0xM/J/ypS6KZGZtOLCeGo..XYsWqPXVU1vOUcolCXKAO6am	54350154-0a3f-424c-be05-cbaf52cbee9c	t	f	\N	\N	2026-04-02 08:55:02.147	2026-04-02 08:58:13.248
2367443b-a3ec-4dcf-bc3a-79787c99e04e	Quentin	Vaisala	q.vaisala@vogo-group.com	$2b$12$6Wh8qSGmsLn1xb9ws.Czh.LL4Tz5Fw3yCZzQWkGGI1l/LRBtgMZXa	a35dcb49-584c-40ff-b832-44a76d122fe3	t	f	\N	\N	2026-04-03 07:21:28.64	2026-04-03 07:23:19.938
1209678c-aed7-4d79-b4bb-e047b24e23d1	agent	agent	agent@agent.com	$2b$12$sPzst8Upa/B4pv2QuihgLu8N9B6YuTztTJqq4pJgfHcgTHhjhRlym	a35dcb49-584c-40ff-b832-44a76d122fe3	t	t	\N	\N	2026-04-07 14:18:56.839	2026-04-07 14:18:56.839
b3b74e28-0486-4b48-ade6-8d52f60935cc	Rojo	Razafimahefa	r.eazafimahefa@vogo-group.com	$2b$12$0kg6ucDpXYk9wAVK.rz2TOQHt7jciEWnTtAgTRxUBn7tiqNFL4UDW	a35dcb49-584c-40ff-b832-44a76d122fe3	t	t	\N	\N	2026-04-07 14:21:04.675	2026-04-07 14:21:04.675
bec542d0-8463-4e5b-a008-9bfc9e3bc7a7	Loic	Four	l.four@vogo-group.com	$2b$12$lP8OFgI5qDXF3RdoqjCRTebnQUUKY3.zmkOWz/ddSA0Xo0pvOTjGq	54350154-0a3f-424c-be05-cbaf52cbee9c	t	f	\N	\N	2026-04-07 12:09:25.78	2026-04-08 07:49:52.029
f026476a-77e9-4200-ae91-ec38b96da240	Benjamin	Turc	b.turc@vogo-group.com	$2b$12$qqpUVKB7hoR4FS6q5osbOurAaEBF80brcVRHkgFZz1lrl/t3PRW4G	a35dcb49-584c-40ff-b832-44a76d122fe3	t	f	\N	\N	2026-04-08 09:41:25.561	2026-04-08 12:13:25.108
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
5f2cd3c6-7f5c-4492-a661-d937c76431e8	f69b78d50319db9cf065c7aba8b8748df5834d7700a4a0b63f2b94a6c237b303	2026-04-03 17:07:04.939249+02	20260403150654_add_match_attachment	\N	\N	2026-04-03 17:07:04.871701+02	1
c7be7d7c-ccde-4bc7-874a-6f3765fce51f	1931e8c1ca278e83f6d53e60bc8e18c0d17669935a295913097ec1d4ab17792a	2026-04-08 09:18:17.006609+02	20260408120000_add_knowledge_base		\N	2026-04-08 09:18:17.006609+02	0
\.


--
-- Name: ActivityLog ActivityLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivityLog"
    ADD CONSTRAINT "ActivityLog_pkey" PRIMARY KEY (id);


--
-- Name: Attachment Attachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_pkey" PRIMARY KEY (id);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: ClientClub ClientClub_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientClub"
    ADD CONSTRAINT "ClientClub_pkey" PRIMARY KEY (id);


--
-- Name: ClientOrganisation ClientOrganisation_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientOrganisation"
    ADD CONSTRAINT "ClientOrganisation_pkey" PRIMARY KEY (id);


--
-- Name: ClientPole ClientPole_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientPole"
    ADD CONSTRAINT "ClientPole_pkey" PRIMARY KEY (id);


--
-- Name: ClientRole ClientRole_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientRole"
    ADD CONSTRAINT "ClientRole_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: KbArticle KbArticle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KbArticle"
    ADD CONSTRAINT "KbArticle_pkey" PRIMARY KEY (id);


--
-- Name: KbAttachment KbAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KbAttachment"
    ADD CONSTRAINT "KbAttachment_pkey" PRIMARY KEY (id);


--
-- Name: MatchAttachment MatchAttachment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MatchAttachment"
    ADD CONSTRAINT "MatchAttachment_pkey" PRIMARY KEY (id);


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: Settings Settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Settings"
    ADD CONSTRAINT "Settings_pkey" PRIMARY KEY (id);


--
-- Name: SurveyResponse SurveyResponse_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SurveyResponse"
    ADD CONSTRAINT "SurveyResponse_pkey" PRIMARY KEY (id);


--
-- Name: SurveySend SurveySend_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SurveySend"
    ADD CONSTRAINT "SurveySend_pkey" PRIMARY KEY (id);


--
-- Name: SurveyTemplate SurveyTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SurveyTemplate"
    ADD CONSTRAINT "SurveyTemplate_pkey" PRIMARY KEY (id);


--
-- Name: TicketType TicketType_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TicketType"
    ADD CONSTRAINT "TicketType_pkey" PRIMARY KEY (id);


--
-- Name: Ticket Ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Category_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Category_name_key" ON public."Category" USING btree (name);


--
-- Name: Category_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Category_slug_key" ON public."Category" USING btree (slug);


--
-- Name: ClientClub_name_organisationId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ClientClub_name_organisationId_key" ON public."ClientClub" USING btree (name, "organisationId");


--
-- Name: ClientOrganisation_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ClientOrganisation_name_key" ON public."ClientOrganisation" USING btree (name);


--
-- Name: ClientPole_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ClientPole_name_key" ON public."ClientPole" USING btree (name);


--
-- Name: ClientRole_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ClientRole_name_key" ON public."ClientRole" USING btree (name);


--
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- Name: Settings_key_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Settings_key_key" ON public."Settings" USING btree (key);


--
-- Name: SurveyResponse_surveySendId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SurveyResponse_surveySendId_key" ON public."SurveyResponse" USING btree ("surveySendId");


--
-- Name: SurveySend_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SurveySend_token_key" ON public."SurveySend" USING btree (token);


--
-- Name: TicketType_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TicketType_name_key" ON public."TicketType" USING btree (name);


--
-- Name: Ticket_ticketNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Ticket_ticketNumber_key" ON public."Ticket" USING btree ("ticketNumber");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: ActivityLog ActivityLog_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivityLog"
    ADD CONSTRAINT "ActivityLog_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ActivityLog ActivityLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ActivityLog"
    ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_commentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES public."Comment"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Attachment Attachment_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Attachment Attachment_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Attachment"
    ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ClientClub ClientClub_organisationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ClientClub"
    ADD CONSTRAINT "ClientClub_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES public."ClientOrganisation"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Client Client_clubId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES public."ClientClub"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Client Client_organisationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES public."ClientOrganisation"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Client Client_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."ClientRole"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Comment Comment_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Comment Comment_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KbArticle KbArticle_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KbArticle"
    ADD CONSTRAINT "KbArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KbArticle KbArticle_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KbArticle"
    ADD CONSTRAINT "KbArticle_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: KbArticle KbArticle_sourceTicketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KbArticle"
    ADD CONSTRAINT "KbArticle_sourceTicketId_fkey" FOREIGN KEY ("sourceTicketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: KbAttachment KbAttachment_articleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KbAttachment"
    ADD CONSTRAINT "KbAttachment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES public."KbArticle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: KbAttachment KbAttachment_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."KbAttachment"
    ADD CONSTRAINT "KbAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: MatchAttachment MatchAttachment_uploadedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."MatchAttachment"
    ADD CONSTRAINT "MatchAttachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SurveyResponse SurveyResponse_surveySendId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SurveyResponse"
    ADD CONSTRAINT "SurveyResponse_surveySendId_fkey" FOREIGN KEY ("surveySendId") REFERENCES public."SurveySend"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SurveySend SurveySend_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SurveySend"
    ADD CONSTRAINT "SurveySend_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_poleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_poleId_fkey" FOREIGN KEY ("poleId") REFERENCES public."ClientPole"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Ticket Ticket_typeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES public."TicketType"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict bWcsH198cDKL4V7WkLJzDXDBGuxxBx4rfKCETFYKft01nqp1D754O5JipCPr79U

