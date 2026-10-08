-- phpMyAdmin SQL Dump
-- version 4.9.7deb1
-- https://www.phpmyadmin.net/
--
-- Хост: localhost:3306
-- Время создания: Май 18 2021 г., 14:04
-- Версия сервера: 8.0.25-0ubuntu0.20.10.1
-- Версия PHP: 7.4.9

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- База данных: `lena`
--

-- --------------------------------------------------------

--
-- Структура таблицы `customer`
--

CREATE TABLE `customer` (
  `Codebuyer` int NOT NULL,
  `FIO` text NOT NULL,
  `Telephone` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `customer`
--

INSERT INTO `customer` (`Codebuyer`, `FIO`, `Telephone`) VALUES
(1, 'asdasd', 123123123),
(2, 'asdasd', 123123123),
(3, 'Вася Петров', 7999999),
(4, 'Вася Петров', 7999999),
(5, 'Вася Петров', 7999999),
(6, 'Вася Петров', 7999999),
(7, 'Вася Петров', 7999999),
(8, 'Вася Петров', 7999999),
(9, 'Вася Петров', 7999999);

-- --------------------------------------------------------

--
-- Структура таблицы `list`
--

CREATE TABLE `list` (
  `Codetovara` int NOT NULL,
  `Codebuyer` int NOT NULL,
  `Quantity` int NOT NULL,
  `Summa` int NOT NULL,
  `Codelista` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `list1`
--

CREATE TABLE `list1` (
  `id` int NOT NULL,
  `customerid` int NOT NULL,
  `amount` int NOT NULL,
  `tovari` text COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Дамп данных таблицы `list1`
--

INSERT INTO `list1` (`id`, `customerid`, `amount`, `tovari`) VALUES
(1, 9, 649, '4x1;7x1;11x1;12x15;');

-- --------------------------------------------------------

--
-- Структура таблицы `proiz`
--

CREATE TABLE `proiz` (
  `Codeproiz` int NOT NULL,
  `Nameproiz` text NOT NULL,
  `Country` text NOT NULL,
  `Exp` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Структура таблицы `tovar`
--

CREATE TABLE `tovar` (
  `Codetovara` int NOT NULL,
  `Name` text NOT NULL,
  `Codeproiz` int NOT NULL,
  `Ves` int NOT NULL,
  `Color` text NOT NULL,
  `Type` text NOT NULL,
  `Garant` int NOT NULL,
  `Cost` int NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Дамп данных таблицы `tovar`
--

INSERT INTO `tovar` (`Codetovara`, `Name`, `Codeproiz`, `Ves`, `Color`, `Type`, `Garant`, `Cost`) VALUES
(4, 'asd', 5, 3, 'red', 'yrh', 6, 9),
(5, 'adg', 25, 12, 'white', 'rubber', 6, 76),
(7, '', 0, 0, '', '', 0, 0),
(11, 'dayfgyg', 1, 2, 'red', 'tpw', 5, 25),
(12, 'isfugh', 234, 365, 'red', 'iruit', 5, 41);

--
-- Индексы сохранённых таблиц
--

--
-- Индексы таблицы `customer`
--
ALTER TABLE `customer`
  ADD PRIMARY KEY (`Codebuyer`);

--
-- Индексы таблицы `list`
--
ALTER TABLE `list`
  ADD PRIMARY KEY (`Codelista`);

--
-- Индексы таблицы `list1`
--
ALTER TABLE `list1`
  ADD PRIMARY KEY (`id`);

--
-- Индексы таблицы `proiz`
--
ALTER TABLE `proiz`
  ADD PRIMARY KEY (`Codeproiz`);

--
-- Индексы таблицы `tovar`
--
ALTER TABLE `tovar`
  ADD PRIMARY KEY (`Codetovara`);

--
-- AUTO_INCREMENT для сохранённых таблиц
--

--
-- AUTO_INCREMENT для таблицы `customer`
--
ALTER TABLE `customer`
  MODIFY `Codebuyer` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT для таблицы `list`
--
ALTER TABLE `list`
  MODIFY `Codelista` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `list1`
--
ALTER TABLE `list1`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT для таблицы `proiz`
--
ALTER TABLE `proiz`
  MODIFY `Codeproiz` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT для таблицы `tovar`
--
ALTER TABLE `tovar`
  MODIFY `Codetovara` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
