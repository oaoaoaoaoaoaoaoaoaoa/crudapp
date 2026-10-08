<?php include 'foo.php'; ?>
<!doctype html>
<html lang="en">
  <head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
    <link rel="stylesheet" href="https://pro.fontawesome.com/releases/v5.10.0/css/all.css" integrity="sha384-AYmEC3Yw5cVb3ZcuHtOA93w35dYTsvhLPVnYs9eStHfGJvOvKxVfELGroGkvsg+p" crossorigin="anonymous"/>
    <title>Hello, world!</title>
  </head>
  <body>
  <p><a href="index.php">Начальная страница(добавление/удаление товара)</a></p>
  <p><a href="cart.php">Корзина</a></p>
  <p><a href="checkout.php">Checkout</a></p>
  <div class="container">
      <div class="row">
          <div class="col-12">
          <table class="table table-striped table-hover mt-2">
            <thead class="thead-">
              <th>Код товара</th>
              <th>Наименование</th>
              <th>Код производителя</th>
              <th>Вес</th>
              <th>Цвет</th>
              <th>Тип</th>
              <th>Гарантия</th>
              <th>Стоимость</th>
              <th>Действие</th>
            </thead>
            <tbody>
              <?php foreach ($result as $res) { ?>
              <tr>
                <td><?php echo $res->Codetovara; ?></td>
                <td><?php echo $res->Name; ?></td>
                <td><?php echo $res->Codeproiz; ?></td>
                <td><?php echo $res->Ves; ?></td>
                <td><?php echo $res->Color; ?></td>
                <td><?php echo $res->Type; ?></td>
                <td><?php echo $res->Garant; ?></td>
                <td><?php echo $res->Cost; ?></td>

                <td> <p><button class="btn btn-primary btn-buy" id="<?php echo $res->Codetovara; ?>">Купить</button></p> </td>


              </tr>
                <!-- Modal edit-->
              <div class="modal fade" id="edit<?php echo $res->Codetovara; ?>" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                  <div class="modal-content">
                    <div class="modal-header">
                      <h5 class="modal-title" id="exampleModalLabel">Изменить запись</h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                      <form action="?Codetovara=<?php echo $res->Codetovara; ?>" method="post">
                      <div class="form-group">
                        <small>Код товара</small>
                        <input type="text" class="form-control" name="Codetovara" value="<?php echo $res->Codetovara; ?>">
                      </div>
                      <div class="form-group">
                        <small>Наименование</small>
                        <input type="text" class="form-control" name="Name" value="<?php echo $res->Name; ?>">
                      </div>
                      <div class="form-group">
                        <small>Код производителя</small>
                        <input type="text" class="form-control" name="Codeproiz" value="<?php echo $res->Codeproiz; ?>">
                      </div>
                      <div class="form-group">
                        <small>Вес</small>
                        <input type="text" class="form-control" name="Ves" value="<?php echo $res->Ves; ?>">
                      </div>
                      <div class="form-group">
                        <small>Цвет</small>
                        <input type="text" class="form-control" name="Color" value="<?php echo $res->Color; ?>">
                      </div>
                      <div class="form-group">
                        <small>Тип</small>
                        <input type="text" class="form-control" name="Type" value="<?php echo $res->Type; ?>">
                      </div>
                      <div class="form-group">
                        <small>Гарантия</small>
                        <input type="text" class="form-control" name="Garant" value="<?php echo $res->Garant; ?>">
                      </div>
                      <div class="form-group">
                        <small>Стоимость</small>
                        <input type="text" class="form-control" name="Cost" value="<?php echo $res->Cost; ?>">
                      </div>
                      
                    </div>
                    <div class="modal-footer">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                      <button type="submit" class="btn btn-primary" name="edit">Сохранить</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Modal edit-->
              <!-- Modal delete-->
              <div class="modal fade" id="delete<?php echo $res->Codetovara; ?>" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
                <div class="modal-dialog">
                  <div class="modal-content">
                    <div class="modal-header">
                      <h5 class="modal-title" id="exampleModalLabel">Удалить запись № <?php echo $res->Codetovara; ?></h5>
                      <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-footer">
                      <form action="?Codetovara=<?php echo $res->Codetovara; ?>" method="post">
                      <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
                      <button type="submit" class="btn btn-danger" name="delete">Удалить</button>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <!-- Modal delete-->
              <?php } ?>
            </tbody>
          </table>
          </div>
      </div>
  </div>

  <!-- Modal create-->
  <div class="modal fade" id="create" tabindex="-1" aria-labelledby="exampleModalLabel" aria-hidden="true">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="exampleModalLabel">Добавить запись</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form action="" method="post">
          <div class="form-group">
            <small>Код товара</small>
            <input type="text" class="form-control" name="Codetovara">
          </div>
          <div class="form-group">
            <small>Наименование</small>
            <input type="text" class="form-control" name="Name">
          </div>
          <div class="form-group">
            <small>Код производителя</small>
            <input type="text" class="form-control" name="Codeproiz">
          </div>
          <div class="form-group">
            <small>Вес</small>
            <input type="text" class="form-control" name="Ves">
          </div>
          <div class="form-group">
            <small>Цвет</small>
            <input type="text" class="form-control" name="Color">
          </div>
          <div class="form-group">
            <small>Тип</small>
            <input type="text" class="form-control" name="Type">
          </div>
          <div class="form-group">
            <small>Гарантия</small>
            <input type="text" class="form-control" name="Garant">
          </div>
          <div class="form-group">
            <small>Стоимость</small>
            <input type="text" class="form-control" name="Cost">
          </div>
          
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Закрыть</button>
          <button type="submit" class="btn btn-primary" name="add">Сохранить</button>
          </form>

          <a class="btn btn-default btn-lg" href="cart.php">
    Корзина
    <span class="badge basker_kol">0</span>
</a>
        </div>
      </div>
    </div>
  </div>
  <!-- Modal create-->
  <!-- Optional JavaScript -->
  <!-- jQuery first, then Popper.js, then Bootstrap JS -->
  <script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.14.7/umd/popper.min.js" integrity="sha384-UO2eT0CpHqdSJQ6hJty5KVphtPhzWj9WO1clHTMGa3JDZwrnQq4sF86dIHNDz0W1" crossorigin="anonymous"></script>
  <script src="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/js/bootstrap.min.js" integrity="sha384-JjSmVgyd0p3pXB1rRibZUAYoIIy6OrQ6VrjIEaFf/nJGzIxFDsf4x0xIM+B07jRM" crossorigin="anonymous"></script>
  <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js"></script>
    <script>
    $('.btn-buy').click(function () {//клип на кнопку
        var id = $(this).attr('id'); //получаем id этой кнопки
            $.ajax({//передаем ajax-запросом данные
            type: "POST", //метод передачи данных
            url: 'addtocart.php',//php-файл для обработки данных
            data: {id_tov: id},//передаем наши данные
            success: function(data) {//
                $('.basker_kol').html(data);//меняем количество товаров на кнопке корзины 
                }
            });
    });
</script>
  

  </body>
</html>