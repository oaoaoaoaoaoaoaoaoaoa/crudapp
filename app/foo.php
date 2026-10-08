<?php

include 'db.php';

//$Codetovara = $_GET['Codetovara'];
//$Name = $_POST['Name'];
//$Codeproiz = $_POST['Codeproiz'];
//$Ves = $_POST['Ves'];
//$Color = $_POST['Color'];
//$Type = $_POST['Type'];
//$Garant = $_POST['Garant'];
//$Cost = $_POST['Cost'];
//$get_id = $_GET['id'];

// Create

if (isset($_POST['add'])) {
    $Name = $_POST['Name'];
    $Codeproiz = $_POST['Codeproiz'];
    $Ves = $_POST['Ves'];
    $Color = $_POST['Color'];
    $Type = $_POST['Type'];
    $Garant = $_POST['Garant'];
    $Cost = $_POST['Cost'];
    $sql = ("INSERT INTO `tovar` (`Name`, `Codeproiz`, `Ves`, `Color`, `Type`, `Garant`, `Cost`) VALUES (?,?,?,?,?,?,?)");
    $query = $pdo->prepare($sql);
    $query->execute([$Name, $Codeproiz, $Ves, $Color, $Type, $Garant, $Cost]);
    if ($query) {
        header("Location: ". $_SERVER['HTTP_REFERER']);
    }
}

// Read 
$sql=$pdo->prepare("SELECT * FROM tovar");
$sql->execute();
$result = $sql->fetchAll(PDO::FETCH_OBJ);

// Update

if (isset($_POST['edit'])) {
    $Codetovara = $_GET['Codetovara'];
    $Name = $_POST['Name'];
    $Codeproiz = $_POST['Codeproiz'];
    $Ves = $_POST['Ves'];
    $Color = $_POST['Color'];
    $Type = $_POST['Type'];
    $Garant = $_POST['Garant'];
    $Cost = $_POST['Cost'];
    $sql = ("UPDATE `tovar` SET `Name`=?, `Codeproiz`=?, `Ves`=?, `Color`=?, `Type`=?, `Garant`=?, `Cost`=? WHERE `Codetovara`=?");
    $query = $pdo->prepare($sql);
    $query->execute([$Name, $Codeproiz, $Ves, $Color, $Type, $Garant, $Cost, $Codetovara]);
    if ($query) {
        header("Location: ". $_SERVER['HTTP_REFERER']);
    }
}

// Delete

if (isset($_POST['delete'])) {
    $Codetovara = $_GET['Codetovara'];
    $sql = ("DELETE FROM `tovar` WHERE `Codetovara`= ?");
    $query = $pdo->prepare($sql);
    $query->execute(array($Codetovara));
    //$query->debugDumpParams();
    //$info = $query->errorInfo();
    //print_r($info);
    if ($query) {
        header("Location: ". $_SERVER['HTTP_REFERER']);
    }
}
