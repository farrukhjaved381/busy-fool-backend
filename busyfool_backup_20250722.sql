--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg120+1)

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
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: busyfool
--

CREATE TYPE public.user_role_enum AS ENUM (
    'owner',
    'staff'
);


ALTER TYPE public.user_role_enum OWNER TO busyfool;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ingredient; Type: TABLE; Schema: public; Owner: busyfool
--

CREATE TABLE public.ingredient (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying,
    unit character varying,
    cost_per_ml numeric(10,2),
    cost_per_gram numeric(10,2),
    cost_per_unit numeric(10,2),
    purchase_price numeric(10,2)
);


ALTER TABLE public.ingredient OWNER TO busyfool;

--
-- Name: product; Type: TABLE; Schema: public; Owner: busyfool
--

CREATE TABLE public.product (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying,
    category character varying,
    sell_price numeric(10,2),
    total_cost numeric(10,2),
    margin_amount numeric(10,2),
    margin_percent numeric(10,2),
    status character varying
);


ALTER TABLE public.product OWNER TO busyfool;

--
-- Name: product_ingredient; Type: TABLE; Schema: public; Owner: busyfool
--

CREATE TABLE public.product_ingredient (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quantity numeric(10,2) NOT NULL,
    unit character varying NOT NULL,
    line_cost numeric(10,2) NOT NULL,
    is_optional boolean DEFAULT false NOT NULL,
    "productId" uuid,
    "ingredientId" uuid
);


ALTER TABLE public.product_ingredient OWNER TO busyfool;

--
-- Name: purchase; Type: TABLE; Schema: public; Owner: busyfool
--

CREATE TABLE public.purchase (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    quantity numeric(10,2) NOT NULL,
    total_cost numeric(10,2) NOT NULL,
    purchase_date timestamp without time zone DEFAULT now() NOT NULL,
    "ingredientId" uuid,
    "userId" uuid
);


ALTER TABLE public.purchase OWNER TO busyfool;

--
-- Name: sale; Type: TABLE; Schema: public; Owner: busyfool
--

CREATE TABLE public.sale (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    product_name character varying,
    quantity numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    sale_date timestamp without time zone DEFAULT now() NOT NULL,
    "productId" uuid,
    "userId" uuid
);


ALTER TABLE public.sale OWNER TO busyfool;

--
-- Name: user; Type: TABLE; Schema: public; Owner: busyfool
--

CREATE TABLE public."user" (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying,
    email character varying NOT NULL,
    password character varying NOT NULL,
    role public.user_role_enum DEFAULT 'owner'::public.user_role_enum NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    last_updated timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public."user" OWNER TO busyfool;

--
-- Data for Name: ingredient; Type: TABLE DATA; Schema: public; Owner: busyfool
--

COPY public.ingredient (id, name, unit, cost_per_ml, cost_per_gram, cost_per_unit, purchase_price) FROM stdin;
\.


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: busyfool
--

COPY public.product (id, name, category, sell_price, total_cost, margin_amount, margin_percent, status) FROM stdin;
\.


--
-- Data for Name: product_ingredient; Type: TABLE DATA; Schema: public; Owner: busyfool
--

COPY public.product_ingredient (id, quantity, unit, line_cost, is_optional, "productId", "ingredientId") FROM stdin;
\.


--
-- Data for Name: purchase; Type: TABLE DATA; Schema: public; Owner: busyfool
--

COPY public.purchase (id, quantity, total_cost, purchase_date, "ingredientId", "userId") FROM stdin;
\.


--
-- Data for Name: sale; Type: TABLE DATA; Schema: public; Owner: busyfool
--

COPY public.sale (id, product_name, quantity, total_amount, sale_date, "productId", "userId") FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: busyfool
--

COPY public."user" (id, name, email, password, role, created_at, last_updated) FROM stdin;
\.


--
-- Name: ingredient PK_6f1e945604a0b59f56a57570e98; Type: CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.ingredient
    ADD CONSTRAINT "PK_6f1e945604a0b59f56a57570e98" PRIMARY KEY (id);


--
-- Name: purchase PK_86cc2ebeb9e17fc9c0774b05f69; Type: CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT "PK_86cc2ebeb9e17fc9c0774b05f69" PRIMARY KEY (id);


--
-- Name: product PK_bebc9158e480b949565b4dc7a82; Type: CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT "PK_bebc9158e480b949565b4dc7a82" PRIMARY KEY (id);


--
-- Name: user PK_cace4a159ff9f2512dd42373760; Type: CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY (id);


--
-- Name: sale PK_d03891c457cbcd22974732b5de2; Type: CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT "PK_d03891c457cbcd22974732b5de2" PRIMARY KEY (id);


--
-- Name: product_ingredient PK_e7431906c21f94c0152d6b0db99; Type: CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.product_ingredient
    ADD CONSTRAINT "PK_e7431906c21f94c0152d6b0db99" PRIMARY KEY (id);


--
-- Name: user UQ_e12875dfb3b1d92d7d7c5377e22; Type: CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE (email);


--
-- Name: product_ingredient FK_1525d4cd30cd2af9de7952a0fe2; Type: FK CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.product_ingredient
    ADD CONSTRAINT "FK_1525d4cd30cd2af9de7952a0fe2" FOREIGN KEY ("ingredientId") REFERENCES public.ingredient(id);


--
-- Name: purchase FK_33520b6c46e1b3971c0a649d38b; Type: FK CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT "FK_33520b6c46e1b3971c0a649d38b" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: sale FK_a0a99bbb3f0ae6ecea2abc7393b; Type: FK CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT "FK_a0a99bbb3f0ae6ecea2abc7393b" FOREIGN KEY ("productId") REFERENCES public.product(id);


--
-- Name: sale FK_bf176f13c0bce3c693b24523794; Type: FK CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.sale
    ADD CONSTRAINT "FK_bf176f13c0bce3c693b24523794" FOREIGN KEY ("userId") REFERENCES public."user"(id);


--
-- Name: product_ingredient FK_d6fd52ba735eee4514d0a9a92cc; Type: FK CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.product_ingredient
    ADD CONSTRAINT "FK_d6fd52ba735eee4514d0a9a92cc" FOREIGN KEY ("productId") REFERENCES public.product(id);


--
-- Name: purchase FK_def4311fe8efc3e7ed5a56fd60d; Type: FK CONSTRAINT; Schema: public; Owner: busyfool
--

ALTER TABLE ONLY public.purchase
    ADD CONSTRAINT "FK_def4311fe8efc3e7ed5a56fd60d" FOREIGN KEY ("ingredientId") REFERENCES public.ingredient(id);


--
-- PostgreSQL database dump complete
--

